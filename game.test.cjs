const test=require('node:test'),assert=require('node:assert/strict'),G=require('./game.js');
test('fresh state validates and tea merge consumes exactly two leaves',()=>{const s=G.fresh();assert.ok(G.valid(s));assert.equal(G.move(s,0,1).merged,true);assert.equal(s.board[0],null);assert.equal(s.board[1],'tea');assert.equal(s.merged,1);});
test('duplicate order requires two items and pays once',()=>{const s=G.fresh();s.board=s.board.map(x=>x==='tea'?null:x);s.board[0]='tea';assert.equal(G.canServe(s,0),false);s.board[1]='tea';assert.equal(G.serve(s,0).reward,18);assert.equal(s.coins,78);assert.equal(s.board[0],null);assert.equal(s.board[1],null);assert.equal(G.serve(s,0).ok,false);});
test('generation cannot consume energy on a full board or go negative',()=>{const s=G.fresh();s.board=s.board.map(x=>x===null?'leaf':x);assert.equal(G.produce(s).ok,false);assert.equal(s.energy,100);s.board[0]=null;s.energy=0;assert.equal(G.produce(s).ok,false);assert.equal(s.board[0],null);s.energy=1;assert.equal(G.produce(s,'rice').ok,true);assert.equal(s.board[0],'wheat');assert.equal(s.energy,0);});
test('locks require adjacent open cell and funds; cannot move into a lock',()=>{const s=G.fresh();assert.equal(G.unlock(s,48).ok,false);assert.equal(G.move(s,0,5).ok,false);assert.equal(G.unlock(s,5).ok,true);assert.equal(s.coins,45);s.coins=0;assert.equal(G.unlock(s,6).ok,false);});
test('swap and highest tier preserve inventory',()=>{const s=G.fresh();G.move(s,0,3);assert.equal(s.board[0],'sweet');assert.equal(s.board[3],'leaf');const top=G.chains.rice.at(-1);s.board[0]=top;s.board[1]=top;assert.equal(G.move(s,0,1).ok,false);assert.equal(s.board[0],top);assert.equal(s.board[1],top);});
test('invalid saved games rejected',()=>{const s=G.fresh();assert.equal(G.valid({...s,energy:-1}),false);assert.equal(G.valid({...s,orders:[99,1,2]}),false);assert.equal(G.valid({...s,board:Array(49).fill(null)}),false);assert.equal(G.valid(JSON.parse(JSON.stringify(s))),true);});
test('drag delivery consumes dragged item and exactly the required duplicates',()=>{const s=G.fresh();s.board[38]='tea';assert.ok(G.deliver(s,0,38).ok);assert.equal(s.board[38],null);assert.equal(s.board.filter(x=>x==='tea').length,2);assert.equal(s.coins,78);assert.equal(s.served,1);});
test('wrong, incomplete and invalid drops leave board and coins unchanged',()=>{const s=G.fresh();let before=JSON.stringify(s);assert.equal(G.deliver(s,0,0).ok,false);assert.equal(JSON.stringify(s),before);s.board=s.board.map(x=>x==='tea'?null:x);s.board[2]='tea';before=JSON.stringify(s);assert.equal(G.deliver(s,0,2).ok,false);assert.equal(G.deliver(s,9,2).ok,false);assert.equal(JSON.stringify(s),before);});
test('rice and tea generators produce only their own chain and cannot merge across chains',()=>{const s=G.fresh();let r=G.produce(s,'rice');assert.equal(s.board[r.index],'wheat');const rice=r.index;r=G.produce(s,'tea');assert.equal(s.board[r.index],'leaf');assert.equal(s.energy,98);const merge=G.move(s,rice,r.index);assert.equal(merge.merged,undefined);assert.equal(s.merged,0);assert.ok(G.chains.rice.every(x=>!G.chains.tea.includes(x)));for(const chain of Object.values(G.chains))chain.slice(0,-1).forEach((x,i)=>assert.equal(G.items[x].next,chain[i+1]));});
test('old saves gain tea generator without losing existing items, including full boards',()=>{const s=G.fresh();s.board[8]=null;const oldItems=s.board.filter(x=>x&&x!=='locked');G.migrate(s);assert.ok(s.board.includes('teaBasket'));assert.equal(G.valid(s),true);for(const item of oldItems)assert.ok(s.board.includes(item));const full=G.fresh();full.board=full.board.map(x=>x===null||x==='teaBasket'?'leaf':x);G.migrate(full);assert.ok(full.board.includes('teaBasket'));const allOpen=G.fresh();allOpen.board=allOpen.board.map(x=>x===null||x==='locked'||x==='teaBasket'?'leaf':x);const before=JSON.stringify(allOpen);G.migrate(allOpen);assert.equal(JSON.stringify(allOpen),before);});

test('all 30 appended tiers merge in sequence and have packed artwork',()=>{
 const manifest=require('./assets/manifest.json');
 assert.equal(G.chains.rice.length,20);assert.equal(G.chains.tea.length,21);
 for(const chain of Object.values(G.chains)){
  for(let i=0;i<chain.length-1;i++){
   const s=G.fresh();s.board[0]=chain[i];s.board[1]=chain[i];
   assert.equal(G.move(s,0,1).item,chain[i+1]);assert.ok(G.valid(s));
   assert.equal(G.items[chain[i+1]].level,i+2);
  }
  const top=chain.at(-1),s=G.fresh();s.board[0]=top;s.board[1]=top;
  assert.equal(G.move(s,0,1).max,true);
 }
 for(const id of [...G.chains.rice.slice(5),...G.chains.tea.slice(6)]){
  assert.ok(manifest.frames[id]);assert.ok(require('node:fs').existsSync('assets/'+manifest.frames[id].atlas));
 }
});
test('advanced orders appear only for owned advanced items and support drag delivery',()=>{
 const s=G.fresh();G.serve(s,0);assert.ok(s.orders[0]<6);
 const a=G.fresh();a.board[38]='grain06';G.deliver(a,0,2);
 assert.deepEqual(G.orders[a.orders[0]].needs,['grain06']);
 assert.equal(G.deliver(a,0,38).ok,true);assert.equal(a.board[38],null);
 assert.ok(G.valid(a));
});
