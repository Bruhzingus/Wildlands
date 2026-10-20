import test from 'node:test';
import assert from 'node:assert/strict';
import {AutomaticQuality,graphicsProfile,initialQuality} from '../src/game/graphics.ts';
import {FrameMetrics} from '../src/game/performance.ts';
import {DEFAULT_SETTINGS} from '../src/game/settings.ts';

test('graphics presets bound high DPI while resolution and effect density remain independent',()=>{
 assert.equal(initialQuality(4,8),'low');assert.equal(initialQuality(12,8),'high');assert.equal(initialQuality(6,8),'balanced');
 const low=graphicsProfile({...DEFAULT_SETTINGS,graphicsQuality:'low'},'high',3);
 const high=graphicsProfile({...DEFAULT_SETTINGS,graphicsQuality:'high'},'low',3);
 assert.equal(low.hardwareScaling,1);assert.equal(high.hardwareScaling,.5);
 const reduced=graphicsProfile({...DEFAULT_SETTINGS,graphicsQuality:'high',resolution:.5,vfxDensity:.5},'low',3);
 assert.equal(reduced.hardwareScaling,1);assert.equal(reduced.effectDensity,.5);
 assert.equal(graphicsProfile(DEFAULT_SETTINGS,'balanced',1).quality,'balanced');
});

test('automatic quality uses sustained active intervals with hysteresis and ignores suspension spikes',()=>{
 const quality=new AutomaticQuality('high');quality.update(20);quality.update(NaN);
 for(let i=0;i<100;i++)quality.update(1/60);assert.equal(quality.quality,'high');
 for(let i=0;i<220;i++)quality.update(1/30);assert.equal(quality.quality,'balanced');
 for(let i=0;i<245;i++)quality.update(1/30);assert.equal(quality.quality,'low');
 for(let i=0;i<1200;i++)quality.update(1/60);assert.equal(quality.quality,'low');
 for(let i=0;i<1200;i++)quality.update(1/60);assert.equal(quality.quality,'balanced');
 quality.resetWindow();assert.equal(quality.quality,'balanced');
 const slow=new AutomaticQuality('high');for(let i=0;i<100;i++)slow.update(.3);assert.equal(slow.quality,'low');
});

test('development performance metrics retain only a bounded recent window',()=>{
 const metrics=new FrameMetrics();for(let i=0;i<1000;i++)metrics.record(i,1,2,3);
 metrics.record(NaN,1,2,3);const report=metrics.inspect();assert.equal(report.samples,240);
 assert.equal(report.frame.max,999);assert.ok(report.frame.median>=760);assert.equal(report.simulation.p95,1);
 metrics.reset();assert.equal(metrics.inspect().samples,0);
});
