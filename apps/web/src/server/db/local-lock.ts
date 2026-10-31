import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** PGlite's Node filesystem must have only one owning process. */
export function lockLocalDatabase(directory: string): () => void {
  const filename = `${path.resolve(directory)}.owner.lock`;
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const owner = JSON.stringify({ pid: process.pid, token: randomUUID() });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      fs.writeFileSync(filename, owner, { flag: 'wx' });
      return () => {
        try { if (fs.readFileSync(filename, 'utf8') === owner) fs.unlinkSync(filename); } catch { /* Already released. */ }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      let previous: string;
      let pid: number;
      try {
        previous = fs.readFileSync(filename, 'utf8');
        pid = JSON.parse(previous).pid;
        if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid database lock');
      } catch {
        throw new Error(`Local database lock is not readable: ${filename}. Stop all app processes before inspecting it.`);
      }
      try { process.kill(pid, 0); } catch (checkError) {
        if ((checkError as NodeJS.ErrnoException).code === 'ESRCH') {
          try { if (fs.readFileSync(filename, 'utf8') === previous) fs.unlinkSync(filename); } catch { /* Another opener won. */ }
          continue;
        }
      }
      throw new Error(`This local database is already open in process ${pid}. Stop the other app before restarting; use separate PGLITE_DIR folders for isolated tests.`);
    }
  }
  throw new Error('Could not acquire the local database lock. Another app may be starting.');
}
