import { copyFile,mkdir,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { checkSurfaceClearance } from './check-surfaces.mjs';
// Fail before touching the release folder if structural finishes overlap.
const surfaceReport=checkSurfaceClearance();
console.log(`Surface gate passed: ${surfaceReport.layers} assemblies / ${surfaceReport.samples} triangle samples`);
const destination='release/Sunspark Rumble';
export const releaseFiles=['index.html','style.css','loader.js','favicon.svg','game.bundle.js','Launch Sunspark Rumble.cmd','README.md','START HERE.txt','PATCH-NOTES.md','THIRD-PARTY-NOTICES.txt','LICENSE'];
await mkdir(destination,{recursive:true});
for(const name of releaseFiles){
  await copyFile(name,`${destination}/${name}`);
  const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
  if(await hash(name)!==await hash(`${destination}/${name}`))throw new Error(`Release mismatch: ${name}`);
}
console.log(`Packaged and verified ${releaseFiles.length} files in ${destination}`);
