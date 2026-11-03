import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await fs.readFile(path.join(root, 'fixtures/imported-courses.json'), 'utf8'));
for (const course of catalog) for (const unit of course.modules) {
  if (![course.id, unit.id].every(id => /^[\w-]+$/.test(id))) throw new Error('Invalid package identity');
  const dir = path.join(root, 'apps/web/.data/course-package-media', course.id, unit.id);
  await fs.mkdir(dir, { recursive: true });
  const entries = Object.entries(unit.media);
  for (let i = 0; i < entries.length; i += 2) await Promise.all(entries.slice(i, i + 2).map(async ([name, url]) => {
    if (!/^[\w.-]+\.(wav|mp4)$/.test(name) || !String(url).startsWith('https://scorm-builder-gcs.b-cdn.net/')) throw new Error('Invalid media reference');
    const file = path.join(dir, name);
    try { if ((await fs.stat(file)).size > 0) return; } catch {}
    const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error(`Could not download ${name}: ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const expected = Number(response.headers.get('content-length'));
    if (expected && bytes.length !== expected) throw new Error(`Incomplete media: ${name}`);
    await fs.writeFile(file + '.part', bytes);
    await fs.rename(file + '.part', file);
    console.log(`Cached ${course.id}/${unit.id}/${name}`);
  }));
  console.log(`${course.title} / ${unit.title}: ${entries.length} media files cached.`);
}
