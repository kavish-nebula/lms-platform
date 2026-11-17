import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await fs.readFile(new URL('../../apps/web/drizzle/0025_remove_empty_retired_project_work.sql', import.meta.url), 'utf8');
async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE enrollments(id text PRIMARY KEY); INSERT INTO enrollments VALUES('preserved');
    CREATE TABLE project_work(enrollment_id text PRIMARY KEY REFERENCES enrollments(id),files jsonb NOT NULL,report jsonb,updated_at timestamptz NOT NULL DEFAULT now());`);
  return db;
}
test('retired storage is removed only when empty, preserving enrollment data', async () => {
  const db = await setup();
  try {
    await db.exec('BEGIN;'+migration+'COMMIT;');
    assert.equal((await db.query("SELECT to_regclass('public.project_work') AS table_name")).rows[0].table_name, null);
    assert.deepEqual((await db.query('SELECT id FROM enrollments')).rows, [{id:'preserved'}]);
  } finally { await db.close(); }
});
test('nonempty historical files block cleanup and survive rollback unchanged', async () => {
  const db = await setup();
  try {
    await db.query('INSERT INTO project_work(enrollment_id,files) VALUES($1,$2)', ['preserved','{"lesson.py":"learner work"}']);
    await db.exec('BEGIN');
    await assert.rejects(db.exec(migration), /historical learner files/);
    await db.exec('ROLLBACK');
    assert.deepEqual((await db.query('SELECT files FROM project_work')).rows, [{files:{'lesson.py':'learner work'}}]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM enrollments')).rows[0].n,1);
  } finally { await db.close(); }
});
