import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { lockLocalDatabase } from '@/server/db/local-lock';
import { db, closeDb } from '@/server/db/client';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-db-lock-'));
const data = path.join(folder, 'pglite');
try {
  const release = lockLocalDatabase(data);
  assert.throws(() => lockLocalDatabase(data), /already open/);
  release();
  release();
  const releaseAgain = lockLocalDatabase(data);
  releaseAgain();

  const deadPid = Number(execFileSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' }).trim());
  fs.writeFileSync(`${data}.owner.lock`, JSON.stringify({ pid: deadPid, token: 'old' }));
  const afterCrash = lockLocalDatabase(data);
  assert.equal(JSON.parse(fs.readFileSync(`${data}.owner.lock`, 'utf8')).pid, process.pid);
  afterCrash();

  fs.writeFileSync(`${data}.owner.lock`, 'not a valid lock');
  assert.throws(() => lockLocalDatabase(data), /not readable/);
  assert.equal(fs.readFileSync(`${data}.owner.lock`, 'utf8'), 'not a valid lock');

  const connection = await db();
  await connection.execute('select 1');
  await closeDb();
  await assert.rejects(db(), /shutting down/);
  console.log('PASS local database: exclusive ownership, released/stale locks, malformed lock preservation and graceful close');
} finally {
  fs.rmSync(folder, { recursive: true, force: true });
}
