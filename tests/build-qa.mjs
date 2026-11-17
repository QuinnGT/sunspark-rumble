// Development-only browser scenarios. Never copied into the portable release.
import { build } from 'esbuild';
import { readFile,writeFile } from 'node:fs/promises';
await build({entryPoints:['tests/visual-scenario.js'],bundle:true,minify:true,format:'iife',define:{__SUNSPARK_TEST__:'true'},outfile:'tests/game.qa.bundle.js'});
const html=(await readFile('index.html','utf8')).replace('href="style.css"','href="../style.css"').replace('href="favicon.svg"','href="../favicon.svg"').replace('<script src="loader.js" data-bundle="game.bundle.js"></script>','<script src="game.qa.bundle.js"></script>');
await writeFile('tests/scenario.html',html);
console.log('QA scenarios rebuilt. With npm start running, open http://127.0.0.1:4173/tests/scenario.html?scenario=cover-check');
