// Deterministic stationary-player soak. This checks AI/map logic, not human difficulty.
import {game,snapshot,advance} from './game-harness.mjs';
import {seeded} from '../src/config.js';
import {mkdir,writeFile} from 'node:fs/promises';
const rounds=Number(process.env.SUNHAVEN_ROUNDS||20),reports=[];
await mkdir('tests/artifacts/sunhaven',{recursive:true});
for(const difficulty of ['easy','medium','hard','insane']){
  game.setDifficulty(difficulty);
  for(let round=0;round<rounds;round++){
    Math.random=seeded(round+417);game.botController.rng=Math.random;game.start('match');
    let firstShot=null,firstDamage=null,previousHealth=200,maxStill=0;const last=new Map(),still=new Map();
    const originalBuild=game.botController.callbacks.build;let buildPeak=0;
    game.botController.callbacks.build=(...args)=>{const t=performance.now(),r=originalBuild(...args);buildPeak=Math.max(buildPeak,performance.now()-t);return r;};
    const start=performance.now(),position=snapshot().position;
    while(snapshot().state==='playing'&&snapshot().elapsed<305){
      advance(1);const s=snapshot();if(firstShot===null&&s.bots.some(b=>b.stats.shots>0))firstShot=s.elapsed;
      if(firstDamage===null&&s.health+s.shield<previousHealth)firstDamage=s.elapsed;previousHealth=s.health+s.shield;
      for(const b of s.bots){
        const p=last.get(b.name);const stopped=b.alive&&p&&Math.hypot(p[0]-b.position[0],p[2]-b.position[2])<.15&&!['AIMING','RELOADING','BUILDING'].includes(b.action)&&b.pathLength>0;
        still.set(b.name,stopped?(still.get(b.name)||0)+1:0);maxStill=Math.max(maxStill,still.get(b.name));last.set(b.name,b.position);
      }
    }
    const s=snapshot();game.botController.callbacks.build=originalBuild;
    const report={difficulty,round,position,time:s.elapsed,state:s.state,alive:s.bots.filter(b=>b.alive).length,firstShot,firstDamage,maxStill,buildPeakMs:Math.round(buildPeak*10)/10,cpuMs:Math.round(performance.now()-start),bots:s.bots};reports.push(report);
    await writeFile('tests/artifacts/sunhaven/soak-report.json',JSON.stringify({kind:'stationary player, real game loop, deterministic inputs',reports},null,2));
    console.log(JSON.stringify({...report,bots:undefined}));
    if(s.state!=='result')throw Error('Match did not resolve');
  }
}
