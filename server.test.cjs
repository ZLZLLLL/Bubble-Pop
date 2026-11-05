const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('./server.cjs'),{openStore}=require('./storage.cjs'),G=require('./game.js');
const temporary=()=>fs.mkdtempSync(path.join(os.tmpdir(),'teahouse-'));
test('SQLite survives reopen and rejects stale or invalid updates',()=>{
 const file=path.join(temporary(),'game.sqlite');let store=openStore(file);assert.equal(store.read().revision,0);const s=G.fresh();s.coins=123;store.write(s,0);store.close();
 store=openStore(file);assert.equal(store.read().state.coins,123);assert.throws(()=>store.write(s,0),{status:409});assert.throws(()=>store.write({},1),{status:400});assert.equal(store.read().revision,1);store.close();
});
test('codes grant exact amounts once, persist across reopen, and stale saves cannot undo rewards',()=>{
 const file=path.join(temporary(),'game.sqlite');let store=openStore(file);store.write(G.fresh(),0);
 assert.throws(()=>store.redeem(1,'错误',1),{status:400});assert.throws(()=>store.redeem(1,'喜欢乐乐',0),{status:409});
 let revision=1,total=100;for(const [code,energy] of [['喜欢乐乐',20],['抱抱乐乐',50],['亲亲乐乐',60]]){const r=store.redeem(1,code,revision);total+=energy;revision=r.revision;assert.equal(r.energy,energy);assert.equal(r.state.energy,total);assert.throws(()=>store.redeem(1,code,revision),{status:422});}
 assert.throws(()=>store.write(G.fresh(),1),{status:409});store.close();store=openStore(file);assert.equal(store.read().state.energy,230);assert.throws(()=>store.redeem(1,'喜欢乐乐',revision),{status:422});store.close();
});
test('login sessions expire/revoke and do not store plaintext passwords',()=>{
 const file=path.join(temporary(),'game.sqlite'),store=openStore(file);assert.throws(()=>store.login('lulu','wrong'),{status:401});assert.throws(()=>store.login('other','11111111'),{status:401});const login=store.login('lulu','11111111');assert.equal(store.session(login.token).username,'lulu');store.logout(login.token);assert.equal(store.session(login.token),null);assert.equal(store.session('forged'),null);store.close();
 const reopened=openStore(file),persisted=reopened.login('lulu','11111111');reopened.close();const again=openStore(file);assert.equal(again.session(persisted.token).username,'lulu');
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(file);const u=db.prepare('SELECT * FROM users').get();assert.notEqual(u.password_hash,'11111111');db.prepare('UPDATE sessions SET expires=0').run();assert.equal(again.session(persisted.token),null);db.close();again.close();
});
test('HTTP login, protected APIs, exact redemption, duplicate concurrency, and logout',async()=>{
 const server=createApp({dataDir:temporary(),secureCookie:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const post=(route,input,extra={})=>fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(input)});
 try{
  assert.equal((await fetch(url+'/')).status,200);assert.equal((await fetch(url+'/api/save')).status,401);assert.equal((await post('/api/redeem',{code:'喜欢乐乐',revision:0})).status,401);
  assert.equal((await post('/api/login',{username:'lulu',password:'wrong'})).status,401);
  const login=await post('/api/login',{username:'lulu',password:'11111111'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);const headers={Cookie:cookie.split(';')[0],'Content-Type':'application/json'};
  assert.equal((await fetch(url+'/api/session',{headers})).status,200);
  const initial=await(await fetch(url+'/api/save',{headers})).json();assert.equal(initial.state,null);
  const save=await fetch(url+'/api/save',{method:'PUT',headers,body:JSON.stringify({state:G.fresh(),revision:0})});assert.equal(save.status,200);
  assert.equal((await post('/api/redeem',{code:'喜欢乐乐',revision:1},{...headers,Origin:'https://unrelated.example'})).status,403);
  const responses=await Promise.all([post('/api/redeem',{code:'喜欢乐乐',revision:1},headers),post('/api/redeem',{code:'喜欢乐乐',revision:1},headers)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,422]);
  const saved=await(await fetch(url+'/api/save',{headers})).json();assert.equal(saved.state.energy,120);
  for(const p of ['/data/game.sqlite','/server.cjs','/storage.cjs','/.env'])assert.equal((await fetch(url+p)).status,404);
  assert.equal((await post('/api/logout',{},headers)).status,200);assert.equal((await fetch(url+'/api/save',{headers})).status,401);
 }finally{await new Promise(r=>server.close(r));}
});
