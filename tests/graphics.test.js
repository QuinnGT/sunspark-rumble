import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameMeter, qualityKey, graphicsProfile } from '../src/graphics.js';

test('FPS uses actual elapsed time at low and high frame rates, without physics clamping',()=>{
  for(const hz of [10,20,30,60,144]){
    const meter=new FrameMeter();for(let i=0;i<hz;i++)meter.sample(1/hz);
    assert.ok(Math.abs(meter.value-hz)<.01,`expected ${hz} FPS, got ${meter.value}`);
  }
  const meter=new FrameMeter();for(let i=0;i<10;i++)meter.sample(.04);meter.sample(.6);
  assert.equal(meter.value,11,'a slow frame must count toward the real FPS');
});

test('resetting a sample drops old menu/quality intervals and waits for a fresh gameplay window',()=>{
  const meter=new FrameMeter();for(let i=0;i<30;i++)meter.sample(1/60);meter.reset();
  for(const bad of [0,-1,NaN,Infinity])assert.equal(meter.sample(bad),false);
  for(let i=0;i<29;i++)meter.sample(1/30);assert.equal(meter.value,null);
  meter.sample(1/30);assert.ok(Math.abs(meter.value-30)<.01);
});

test('old quality choices survive and Balanced provides a genuinely intermediate render budget',()=>{
  assert.equal(qualityKey('low'),'low');assert.equal(qualityKey('high'),'high');assert.equal(qualityKey(undefined),'balanced');assert.equal(qualityKey('toString'),'balanced');
  const low=graphicsProfile('low'),mid=graphicsProfile('balanced'),high=graphicsProfile('high');
  assert.equal(low.shadows,false);assert.equal(mid.shadows,true);assert.equal(mid.reflections,false);assert.equal(high.reflections,true);
  assert.ok(low.pixelRatio<mid.pixelRatio&&mid.pixelRatio<high.pixelRatio);
  assert.ok(mid.shadowSize<high.shadowSize&&mid.shadowHz<high.shadowHz);
  assert.ok(low.leafDistance<mid.leafDistance&&mid.leafDistance<high.leafDistance);
});
// Import separately to keep the original profile checks easy to compare.
import {renderPixelRatio,GRAPHICS} from '../src/graphics.js';
test('pixel budgets bound high-DPI and ultrawide drawing buffers',()=>{
  for(const profile of Object.values(GRAPHICS))for(const [w,h,dpr] of [[1600,1000,1],[3840,2160,2],[7680,2160,3]]){
    const ratio=renderPixelRatio(profile,w,h,dpr,8192);
    assert.ok(ratio<=dpr&&ratio<=profile.pixelRatio);assert.ok(w*h*ratio*ratio<=profile.maxPixels+1);assert.ok(Math.max(w,h)*ratio<=8192);
  }
});
