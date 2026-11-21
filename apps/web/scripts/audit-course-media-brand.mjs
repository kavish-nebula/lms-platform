// Read-only inventory. Credentials and learner profiles are never included.
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

process.loadEnvFile('.env.local');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const name = /nebula[\s_-]*know[\s_-]*lab/i;
const tables = [
  ['creator_authored_course_revisions', 'content'],
  ['creator_production_revisions', 'content'],
  ['creator_visual_lessons', 'content'],
  ['adaptation_jobs', 'content'],
  ['adapted_content', 'content'],
  ['scorm_topic_imports', 'source'],
  ['creator_courses', 'brief'],
  ['creator_blueprints', 'output'],
];
const report = { generatedAt: new Date().toISOString(), tables: [], matches: [], visualExports: [], originalMedia: [] };
function inspect(value, scope, location = '') {
  if (typeof value === 'string') {
    if (name.test(value)) report.matches.push({ ...scope, path: location, excerpt: value.slice(Math.max(0, value.search(name) - 80), value.search(name) + 180) });
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) inspect(child, scope, location ? `${location}.${key}` : key);
  }
}
try {
  report.published = (await pool.query('select p.course_id, p.revision_id, r.content->>\'title\' as title from published_authored_courses p join creator_authored_course_revisions r on r.id=p.revision_id')).rows;
  for (const [table, column] of tables) {
    const result = await pool.query(`select id, ${column} as payload from ${table}`);
    const before = report.matches.length;
    for (const row of result.rows) {
      inspect(row.payload, { table, id: row.id });
      if(table==='creator_authored_course_revisions' && report.published.some(p=>p.revision_id===row.id)) for(const module of row.payload.modules) for(const video of module.conceptExplainer.videos) {
        if(video.uploadedVideo||video.sourceMedia)report.originalMedia.push({courseId:report.published.find(p=>p.revision_id===row.id).course_id,moduleId:module.id,videoId:video.id,title:video.title,uploadedVideo:video.uploadedVideo,sourceMedia:video.sourceMedia});
      }
    }
    report.tables.push({ table, rows: result.rowCount, matchingFields: report.matches.length - before });
  }
  report.visualExports = (await pool.query("select j.id, j.revision_id, r.course_id, r.video_id, j.status, j.output from creator_visual_jobs j join creator_visual_lessons r on r.id=j.revision_id where j.kind='export' and j.status='ready' order by j.created_at")).rows;
  const output = path.resolve('../../outputs/course-media-brand-audit.json');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ published: report.published, tables: report.tables, matches: report.matches.slice(0, 25), readyVisualExports: report.visualExports.length, report: output }, null, 2));
} finally { await pool.end(); }
