import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'node:path';
import { copyDatabase, dependencyOrder, tableSignature } from '../lib/database-transfer.mjs';

const schema = `CREATE TABLE parents (id text PRIMARY KEY, data jsonb NOT NULL, at timestamptz NOT NULL, precise numeric NOT NULL);
CREATE TABLE children (id serial PRIMARY KEY, parent_id text REFERENCES parents(id), label text);`;
test('transfer preserves JSON, exact numerics, Unicode, timestamps, foreign keys and sequence positions', async () => {
  const source = new PGlite(); const target = new PGlite();
  try {
    await source.exec(schema); await target.exec(schema);
    await source.query(`INSERT INTO parents VALUES ('p', $1::jsonb, '2026-11-11T12:30:40.123456+05:30', 12345678901234567890.123456789)`, ['{"title":"Learner’s course 日本語","nested":[true,null,{"number":12345678901234567890}]}']);
    await source.exec("INSERT INTO children(id,parent_id,label) VALUES(42,'p','Original progress');");
    const backups=[];
    const report=await copyDatabase(source,target,{writeBackup:async(name,json)=>backups.push({name,json})});
    assert.equal(report.length,2);
    assert.deepEqual(await tableSignature(source,'parents'),await tableSignature(target,'parents'));
    assert.deepEqual(await tableSignature(source,'children'),await tableSignature(target,'children'));
    assert(backups.some(x=>x.json.includes('12345678901234567890.123456789')));
    assert.equal((await target.query("INSERT INTO children(parent_id) VALUES('p') RETURNING id")).rows[0].id,43);
    assert.equal((await source.query('SELECT count(*)::int AS n FROM children')).rows[0].n,1);
  } finally {await source.close();await target.close();}
});
test('refuses existing target rows without deleting or overwriting them', async()=>{
  const source=new PGlite();const target=new PGlite();
  try{await source.exec(schema);await target.exec(schema);await target.exec("INSERT INTO parents VALUES('existing','{}',now(),1)");
    await assert.rejects(copyDatabase(source,target),/not empty/);
    assert.equal((await target.query('SELECT id FROM parents')).rows[0].id,'existing');
  }finally{await source.close();await target.close();}
});
test('schema mismatch and dependency cycles stop before importing',async()=>{
  assert.deepEqual(dependencyOrder(['children','parents'],[{child:'children',parent:'parents'}]),['parents','children']);
  assert.throws(()=>dependencyOrder(['a','b'],[{child:'a',parent:'b'},{child:'b',parent:'a'}]),/cycle/);
  const source=new PGlite();const target=new PGlite();
  try{await source.exec(schema);await target.exec('CREATE TABLE unrelated(id text)');await assert.rejects(copyDatabase(source,target),/schemas differ/);}
  finally{await source.close();await target.close();}
});
test('a failed verification rolls back every imported table',async()=>{
  const source=new PGlite();const target=new PGlite();
  try{await source.exec(schema);await target.exec(schema);await source.exec("INSERT INTO parents VALUES('p','{}',now(),1); INSERT INTO children(parent_id) VALUES('p')");
    const wrapped={query:async(sql,params)=>{const result=await target.query(sql,params);if(sql.includes('string_agg')&&sql.includes('public."children"')&&result.rows[0].count==='1')result.rows[0].hash='forced mismatch';return result;}};
    await assert.rejects(copyDatabase(source,wrapped),/verification failed/);
    assert.equal((await tableSignature(target,'parents')).count,'0');assert.equal((await tableSignature(target,'children')).count,'0');
  }finally{await source.close();await target.close();}
});
test('the complete application schema migrates in foreign-key order',async()=>{
  const source=new PGlite();const target=new PGlite();
  try{
    const migrationsFolder=path.resolve('apps/web/drizzle');
    await migrate(drizzle(source),{migrationsFolder});await migrate(drizzle(target),{migrationsFolder});
    await source.query("INSERT INTO users(id,name,email) VALUES('migration-test','Migration learner','migration@example.invalid')");
    const report=await copyDatabase(source,target);
    assert(report.length>30,'Exercise the full application schema rather than only synthetic tables.');
    assert.equal(report.find(t=>t.table==='users').count,'1');
    assert.equal((await target.query('SELECT id FROM users')).rows[0].id,'migration-test');
  }finally{await source.close();await target.close();}
});
test('historical foreign-key names can differ when constraint semantics match',async()=>{
  const source=new PGlite();const target=new PGlite();
  try{await source.exec(schema);await target.exec(schema);
    await source.exec('ALTER TABLE children RENAME CONSTRAINT children_parent_id_fkey TO historical_parent_reference');
    const report=await copyDatabase(source,target);assert.equal(report.length,2);
  }finally{await source.close();await target.close();}
});
test('equivalent column shapes cannot hide changed defaults or missing constraints',async()=>{
  const source=new PGlite();const target=new PGlite();
  try{await source.exec(schema);await target.exec(schema);
    await target.exec('ALTER TABLE children DROP CONSTRAINT children_parent_id_fkey');
    await assert.rejects(copyDatabase(source,target),/schemas differ/);
    await target.exec('ALTER TABLE children ADD CONSTRAINT children_parent_id_fkey FOREIGN KEY(parent_id) REFERENCES parents(id); ALTER TABLE parents ALTER COLUMN precise SET DEFAULT 0');
    await assert.rejects(copyDatabase(source,target),/schemas differ/);
  }finally{await source.close();await target.close();}
});
