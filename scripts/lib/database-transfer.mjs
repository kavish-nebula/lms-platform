/** Logical data transfer: preserve database-side JSON text, IDs and timestamps. */
export const quoteIdentifier = name => `"${String(name).replaceAll('"', '""')}"`;
const tableName = name => `public.${quoteIdentifier(name)}`;

export async function inventory(connection) {
  const { rows: tables } = await connection.query(`SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
  for (const table of tables) {
    table.columns = (await connection.query(`SELECT column_name, udt_name, is_nullable, is_identity, is_generated,
      column_default, character_maximum_length, numeric_precision, numeric_scale, datetime_precision, collation_name
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [table.name])).rows;
  }
  return tables;
}

export async function schemaSemantics(connection) {
  const tables = await inventory(connection);
  // PostgreSQL 18 exposes NOT NULL as pg_constraint rows; 17 does not. Columns
  // above already compare nullability. Constraint names do not change semantics.
  const constraints = (await connection.query(`SELECT cl.relname AS table_name, c.contype AS type,
    pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public' AND c.contype <> 'n'
    ORDER BY cl.relname, c.contype, pg_get_constraintdef(c.oid)`)).rows;
  const indexes = (await connection.query(`SELECT tablename, indexdef FROM pg_indexes
    WHERE schemaname = 'public' ORDER BY tablename, indexname`)).rows;
  const triggers = (await connection.query(`SELECT c.relname AS table_name, pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal ORDER BY c.relname, t.tgname`)).rows;
  const views = (await connection.query(`SELECT table_name, view_definition FROM information_schema.views
    WHERE table_schema = 'public' ORDER BY table_name`)).rows;
  return { tables, constraints, indexes, triggers, views };
}

export async function tableSignature(connection, name) {
  return (await connection.query(`SELECT count(*)::text AS count,
    md5(coalesce(string_agg(row_hash, '' ORDER BY row_hash), '')) AS hash
    FROM (SELECT md5(to_jsonb(t)::text) AS row_hash FROM ${tableName(name)} t) rows`)).rows[0];
}

export function dependencyOrder(names, dependencies) {
  const remaining = new Set(names);
  const ordered = [];
  while (remaining.size) {
    const ready = [...remaining].filter(name => !dependencies.some(d => d.child === name && d.parent !== name && remaining.has(d.parent)));
    if (!ready.length) throw new Error('Foreign-key cycle: migration stopped without disabling constraints.');
    for (const name of ready) { remaining.delete(name); ordered.push(name); }
  }
  return ordered;
}

export async function copyDatabase(source, target, { onTable = () => {}, writeBackup = async () => {} } = {}) {
  // Both connections use the same representation when hashing timestamptz values.
  for (const connection of [source, target]) {
    await connection.query("SET TIME ZONE 'UTC'");
    await connection.query("SET DateStyle = 'ISO, YMD'");
  }
  const sourceSemantics = await schemaSemantics(source);
  const targetSemantics = await schemaSemantics(target);
  const sourceSchema = sourceSemantics.tables;
  if (JSON.stringify(sourceSemantics) !== JSON.stringify(targetSemantics)) throw new Error('Source and target schemas differ. Migration stopped.');
  const dependencies = (await source.query(`SELECT child.relname AS child, parent.relname AS parent
    FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid JOIN pg_class parent ON parent.oid = c.confrelid
    JOIN pg_namespace ns ON ns.oid = child.relnamespace WHERE c.contype = 'f' AND ns.nspname = 'public'`)).rows;
  const order = dependencyOrder(sourceSchema.map(t => t.name), dependencies);
  const signatures = [];
  await target.query('BEGIN');
  try {
    for (const name of order) {
      await target.query(`LOCK TABLE ${tableName(name)} IN ACCESS EXCLUSIVE MODE`);
      if ((await tableSignature(target, name)).count !== '0') throw new Error(`Target table ${name} is not empty. Nothing will be overwritten.`);
    }
    for (const name of order) {
      const expected = await tableSignature(source, name);
      for (let offset = 0; ; offset += 100) {
        // Do not JSON.parse rows: bigint/numeric precision and nested JSON must survive unchanged.
        const { rows } = await source.query(`SELECT row_to_json(t)::text AS row FROM ${tableName(name)} t LIMIT 100 OFFSET $1`, [offset]);
        if (!rows.length) break;
        const json = `[${rows.map(r => r.row).join(',')}]`;
        await writeBackup(name, json);
        await target.query(`INSERT INTO ${tableName(name)} SELECT * FROM json_populate_recordset(NULL::${tableName(name)}, $1::json)`, [json]);
      }
      const actual = await tableSignature(target, name);
      if (expected.count !== actual.count || expected.hash !== actual.hash) throw new Error(`Row count or content verification failed for ${name}.`);
      signatures.push({ table: name, ...actual });
      onTable(name, actual.count);
    }
    // Restore generated sequence positions for any serial/identity columns.
    const { rows: sequences } = await target.query(`SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND (column_default LIKE 'nextval(%' OR is_identity = 'YES')`);
    for (const { table_name: name, column_name: column } of sequences) {
      const { rows } = await target.query(`SELECT pg_get_serial_sequence($1, $2) AS name`, [`public.${quoteIdentifier(name)}`, column]);
      if (rows[0].name) await target.query(`SELECT setval($1::regclass, coalesce(max(${quoteIdentifier(column)}), 1), max(${quoteIdentifier(column)}) IS NOT NULL) FROM ${tableName(name)}`, [rows[0].name]);
    }
    await target.query('COMMIT');
    return signatures;
  } catch (error) {
    await target.query('ROLLBACK');
    throw error;
  }
}
