// Reproducible offline preparation after npm ci. No runtime asset downloads.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root='node_modules/@dgreenheck/ez-tree/src/lib';
await mkdir('src/generated',{recursive:true});
await build({entryPoints:[`${root}/tree.js`],bundle:true,format:'esm',external:['three'],outfile:'src/generated/tree-generator.js',banner:{js:'// EZ-Tree 1.1.0, Copyright (c) 2024 Daniel Greenheck, MIT. See THIRD-PARTY-NOTICES.txt.\n// Geometry only. Sunspark supplies materials, textures, wind and LOD.'},plugins:[{name:'geometry-only',setup(b){b.onResolve({filter:/^\.\/textures$/},()=>({path:'textures',namespace:'no-textures'}));b.onLoad({filter:/.*/,namespace:'no-textures'},()=>({contents:'export const getBarkTexture=()=>null; export const getLeafTexture=()=>null;',loader:'js'}));}}]});
const assets={};
for(const name of ['oak_color','ash_color'])assets[name]=`${root}/assets/leaves/${name}.png`;
for(const name of ['oak_color_1k','oak_normal_1k','oak_roughness_1k'])assets[name]=`${root}/assets/bark/${name}.jpg`;
for(const name of ['forest_ground_04','rock_boulder_dry','sand_01','grass_path_2'])for(const map of ['Diffuse','nor_gl','Rough'])assets[`${name}_${map}`]=`assets/nature/${name}_${map}.jpg`;
assets.waternormals='assets/nature/waternormals.jpg';
const urls={};for(const [name,path] of Object.entries(assets))urls[name]=`data:image/${path.endsWith('.png')?'png':'jpeg'};base64,${(await readFile(path)).toString('base64')}`;
await writeFile('src/generated/nature-textures.js',`// Embedded licensed textures. Sources: assets/nature/README.md\nexport default ${JSON.stringify(urls)};\n`);
console.log(`Prepared geometry generator and ${Object.keys(urls).length} embedded texture maps.`);
