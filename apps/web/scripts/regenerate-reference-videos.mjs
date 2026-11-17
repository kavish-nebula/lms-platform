// Run from apps/web. Reuses protected text/audio; never publishes or grades.
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
await fs.mkdir('.data/reference-runner',{recursive:true});
await fs.writeFile('.data/reference-runner/server-only.js','export {};');
await fs.writeFile('.data/reference-runner/next-server.js','export class NextResponse extends Response {static json(data,init){return Response.json(data,init)}}');
await build({entryPoints:['scripts/regenerate-reference-videos.ts'],outfile:'.data/reference-runner/run.mjs',bundle:true,platform:'node',format:'esm',target:'node22',tsconfig:'tsconfig.json',alias:{'server-only':'./.data/reference-runner/server-only.js','next/server':'./.data/reference-runner/next-server.js'},external:['ffmpeg-static','google-auth-library','pg','drizzle-orm','@electric-sql/pglite','react','react-dom']});
const child=spawn(process.execPath,['.data/reference-runner/run.mjs',...process.argv.slice(2)],{cwd:process.cwd(),stdio:'inherit',windowsHide:true});
let stopping=false;
const stop=()=>{
  if(stopping||!child.pid)return;stopping=true;
  // Stop this renderer tree only. Completed files remain cached, and the next
  // run recovers the abandoned per-asset lock from its recorded owner PID.
  if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
  else child.kill('SIGTERM');
};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
child.once('error',error=>{console.error(error.message);process.exitCode=1;});
child.once('exit',code=>{process.exitCode=stopping?130:code??1;});
