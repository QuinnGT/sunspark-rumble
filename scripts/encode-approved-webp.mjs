// One-time encoder: re-encodes the two approved PNG colour maps to WebP in headless Chrome
// (canvas.convertToBlob, the OffscreenCanvas twin of toBlob). Node has no WebP encoder and the
// project takes no dependencies. The PNGs stay as the source of record.
// Run: node scripts/encode-approved-webp.mjs   (then: npm run prepare:approved-art)
// Per texture it tries every quality, keeps the smallest WebP whose RGB PSNR against the decoded
// PNG is at least MIN_PSNR (quality 1 is lossless), and records the choice in webp-encode.json.
import {chromium} from 'playwright-core';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
setTimeout(()=>{console.error('encode-approved-webp: timed out');process.exit(1);},180000).unref();
const root='assets/art-proof',MIN_PSNR=42,QUALITIES=[.92,.95,.97,.98,.99,1];
const sources=[['teal-plank-atlas-v1.png','teal-plank-atlas-v1.webp'],['nature/Rocks_Diffuse.png','nature/Rocks_Diffuse.webp']];
const sha=b=>createHash('sha256').update(b).digest('hex');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const records=[];
try{
  const page=await browser.newPage();
  const encoder=`Chrome ${browser.version()} canvas.convertToBlob(image/webp)`;
  for(const [png,webp] of sources){
    const bytes=await readFile(`${root}/${png}`);
    const result=await page.evaluate(async({b64,qualities})=>{
      const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
      const {width,height}=img,canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(img,0,0);const ref=ctx.getImageData(0,0,width,height).data;
      let transparent=0;for(let i=3;i<ref.length;i+=4)if(ref[i]!==255)transparent++;
      const candidates=[];
      for(const quality of qualities){
        const blob=await canvas.convertToBlob({type:'image/webp',quality}),bitmap=await createImageBitmap(blob);
        const check=new OffscreenCanvas(width,height).getContext('2d',{willReadFrequently:true});check.drawImage(bitmap,0,0);
        const out=check.getImageData(0,0,width,height).data;let sq=0,max=0;
        for(let i=0;i<ref.length;i+=4)for(let c=0;c<3;c++){const d=ref[i+c]-out[i+c];sq+=d*d;if(Math.abs(d)>max)max=Math.abs(d);}
        const mse=sq/(width*height*3),buf=new Uint8Array(await blob.arrayBuffer());let bin='';for(let i=0;i<buf.length;i+=32768)bin+=String.fromCharCode(...buf.subarray(i,i+32768));
        candidates.push({quality,bytes:buf.length,psnr:mse?10*Math.log10(255*255/mse):Infinity,maxError:max,b64:btoa(bin)});
      }
      return {width,height,transparent,candidates};
    },{b64:bytes.toString('base64'),qualities:QUALITIES});
    if(result.transparent)throw new Error(`${png} has ${result.transparent} non-opaque pixels; this script only handles opaque colour maps`);
    const pass=result.candidates.filter(c=>c.psnr>=MIN_PSNR).sort((a,b)=>a.bytes-b.bytes);
    if(!pass.length)throw new Error(`${png}: no candidate reached ${MIN_PSNR} dB`);
    const best=pass[0],data=Buffer.from(best.b64,'base64');await writeFile(`${root}/${webp}`,data);
    for(const c of result.candidates)console.log(`${png} q=${c.quality} ${c.bytes} bytes PSNR ${c.psnr.toFixed(2)} dB maxErr ${c.maxError}${c===best?'  <- chosen':''}`);
    records.push({name:webp,source:`${root}/${png}`,sourceSha256:sha(bytes),sourceBytes:bytes.length,file:`${root}/${webp}`,bytes:data.length,sha256:sha(data),encoder,quality:best.quality,lossless:best.quality===1,psnrDb:Number.isFinite(best.psnr)?+best.psnr.toFixed(2):'lossless',candidates:result.candidates.map(({quality,bytes,psnr})=>({quality,bytes,psnrDb:Number.isFinite(psnr)?+psnr.toFixed(2):'lossless'}))});
  }
}finally{await browser.close();}
await writeFile('assets/approved-docks/webp-encode.json',JSON.stringify({minPsnrDb:MIN_PSNR,textures:records},null,2));
