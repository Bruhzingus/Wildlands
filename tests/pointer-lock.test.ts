import test from 'node:test';
import assert from 'node:assert/strict';
import {requestCameraPointerLock} from '../src/game/pointerLock.ts';

const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('camera capture requests raw relative input',async()=>{
 const requests:unknown[]=[];let failures=0;
 requestCameraPointerLock({requestPointerLock(options){requests.push(options);return Promise.resolve();}},()=>true,()=>failures++);
 await settle();
 assert.deepEqual(requests,[{unadjustedMovement:true}]);assert.equal(failures,0);
});

for(const synchronous of [false,true]){
 test(`unsupported raw capture falls back to standard capture after ${synchronous?'a throw':'a rejection'}`,async()=>{
  const requests:unknown[]=[];let failures=0;
  const onError=requestCameraPointerLock({requestPointerLock(options){
   requests.push(options);
   if(options){const error=new DOMException('Raw input unsupported','NotSupportedError');if(synchronous)throw error;return Promise.reject(error);}
   return Promise.resolve();
  }},()=>true,()=>failures++);
  // A promise browser also emits pointerlockerror for its failed raw request.
  onError();await settle();
  assert.deepEqual(requests,[{unadjustedMovement:true},undefined]);assert.equal(failures,0);
 });
}

test('denied capture fails once and never retries browser permission failures',async()=>{
 let requests=0,failures=0;
 const onError=requestCameraPointerLock({requestPointerLock(){requests++;return Promise.reject(new DOMException('Denied','NotAllowedError'));}},()=>true,()=>failures++);
 onError();await settle();
 assert.equal(requests,1);assert.equal(failures,1);
});

test('a failed fallback reports failure without retrying indefinitely',async()=>{
 let requests=0,failures=0;
 requestCameraPointerLock({requestPointerLock(){requests++;return Promise.reject(new DOMException('Unsupported','NotSupportedError'));}},()=>true,()=>failures++);
 await settle();assert.equal(requests,2);assert.equal(failures,1);
});

test('legacy event-only capture accepts raw options and handles an error event',()=>{
 let failures=0;
 const onError=requestCameraPointerLock({requestPointerLock(){}},()=>true,()=>failures++);
 assert.equal(failures,0);onError();assert.equal(failures,1);
});

test('unsupported raw input can fall back to an event-only implementation',async()=>{
 let requests=0,failures=0;
 const onError=requestCameraPointerLock({requestPointerLock(options){
  requests++;if(options)return Promise.reject(new DOMException('Unsupported','NotSupportedError'));
 }},()=>true,()=>failures++);
 onError();await settle();assert.equal(requests,2);assert.equal(failures,0);
 onError();assert.equal(failures,1);
});

test('cancelling capture prevents a late rejection from recapturing or failing a newer request',async()=>{
 let current=true,requests=0,failures=0;
 let reject!:(error:unknown)=>void;
 const onError=requestCameraPointerLock({requestPointerLock(){requests++;return new Promise<void>((_,fail)=>{reject=fail;});}},()=>current,()=>failures++);
 current=false;reject(new DOMException('Unsupported','NotSupportedError'));onError();await settle();
 assert.equal(requests,1);assert.equal(failures,0);
});

test('a synchronous capture exception is reported without escaping the input handler',()=>{
 let failures=0;
 assert.doesNotThrow(()=>requestCameraPointerLock({requestPointerLock(){throw new Error('Unavailable');}},()=>true,()=>failures++));
 assert.equal(failures,1);
});
