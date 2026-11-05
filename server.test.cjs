const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('./server.cjs'),{openStore}=require('./storage.cjs'),G=require('./game.js');
test('SQLite survives reopen and rejects stale or invalid updates',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'teahouse-'));const file=path.join(dir,'game.sqlite');
 let store=openStore(file);assert.equal(store.read().revision,0);const s=G.fresh();s.coins=123;store.write(s,0);store.close();
 store=openStore(file);assert.equal(store.read().state.coins,123);assert.throws(()=>store.write(s,0),{status:409});assert.throws(()=>store.write({},1),{status:400});assert.equal(store.read().revision,1);store.close();
});
test('HTTP auth, persistence, isolation and conflict response',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'teahouse-http-'));const server=createApp({dataDir,password:'test-secret'});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const headers={Authorization:'Basic '+Buffer.from('player:test-secret').toString('base64'),'Content-Type':'application/json'};
 try{
  assert.equal((await fetch(url+'/healthz')).status,200);assert.equal((await fetch(url+'/api/save')).status,401);
  const initial=await (await fetch(url+'/api/save',{headers})).json();assert.equal(initial.state,null);
  const body=JSON.stringify({state:G.fresh(),revision:0});
  assert.equal((await fetch(url+'/api/save',{method:'PUT',headers,body})).status,200);
  assert.equal((await fetch(url+'/api/save',{method:'PUT',headers,body})).status,409);
  assert.equal((await fetch(url+'/api/save',{method:'PUT',headers:{...headers,Origin:'https://unrelated.example'},body})).status,403);
  assert.equal((await fetch(url+'/api/save',{headers})).status,200);
  for(const p of ['/data/game.sqlite','/server.cjs','/assets/source/food.jpg','/.env'])assert.equal((await fetch(url+p,{headers})).status,404);
  assert.equal((await fetch(url+'/',{headers})).status,200);
 }finally{await new Promise(r=>server.close(r));}
});
