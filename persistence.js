const SaveStore=(()=>{
 let revision=0,pending=null,busy=false,stopped=false,timer;
 const status=text=>document.querySelector('.chapter small').textContent=text;
 async function request(method,body){
  const r=await fetch('/api/save',{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Object.assign(new Error('存档请求失败'),{status:r.status});return r.json();
 }
 async function flush(){
  if(busy||!pending||stopped)return;
  busy=true;const snapshot=pending;pending=null;status('正在保存到服务器…');
  try{const r=await request('PUT',{state:snapshot,revision});revision=r.revision;status('已保存到 SQLite');}
  catch(e){pending=pending||snapshot;if(e.status===409){stopped=true;document.querySelector('.game').inert=true;status('存档已在其他页面更新，请刷新');alert('另一页面已更新存档。请刷新后继续，避免覆盖进度。');}else{status('保存失败，正在重试 · 请勿关闭');clearTimeout(timer);timer=setTimeout(flush,3000);}}
  finally{busy=false;}if(pending&&!stopped){clearTimeout(timer);timer=setTimeout(flush,1500);}
 }
 return {
  async load(){const r=await request('GET');revision=r.revision;return r.state;},
  save(s){if(stopped)return;pending=JSON.parse(JSON.stringify(s));status('等待保存…');clearTimeout(timer);timer=setTimeout(flush,250);},
  flush,
  get unsaved(){return !!pending||busy;}
 };
})();
window.addEventListener('beforeunload',e=>{if(SaveStore.unsaved){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)SaveStore.flush();});
