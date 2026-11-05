const SaveStore=(()=>{
 let revision=0,pending=null,inflight=null,stopped=false,timer,lastError=null;
 const status=text=>document.querySelector('.chapter small').textContent=text;
 async function request(path,method,body){
  const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});
  const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error||'存档请求失败'),{status:r.status});return data;
 }
 function failed(e){
  lastError=e;
  if(e.status===401){stopped=true;Auth.expired();}
  else if(e.status===409){stopped=true;document.querySelector('.game').inert=true;status('存档已在其他页面更新，请刷新');alert('另一页面已更新存档。请刷新后继续，避免覆盖进度。');}
  else status('保存失败，正在重试 · 请勿关闭');
 }
 function flush(){
  clearTimeout(timer);if(inflight)return inflight;if(!pending||stopped)return Promise.resolve();
  const snapshot=pending;pending=null;status('正在保存到服务器…');
  inflight=(async()=>{
   try{const r=await request('/api/save','PUT',{state:snapshot,revision});revision=r.revision;lastError=null;status('已保存到 SQLite');}
   catch(e){pending=pending||snapshot;failed(e);}
   finally{inflight=null;if(pending&&!stopped)timer=setTimeout(flush,1500);}
  })();return inflight;
 }
 async function settle(){if(stopped)throw lastError||new Error('请刷新页面');while(inflight||pending){await flush();if(lastError)throw lastError;}}
 return {
  async load(){const r=await request('/api/save','GET');revision=r.revision;return r.state;},
  save(s){if(stopped)return;pending=JSON.parse(JSON.stringify(s));status('等待保存…');clearTimeout(timer);timer=setTimeout(flush,250);},
  async redeem(code){await settle();try{const r=await request('/api/redeem','POST',{code,revision});revision=r.revision;return r;}catch(e){if(e.status===401||e.status===409)failed(e);throw e;}},
  flush,settle,get unsaved(){return !!pending||!!inflight;}
 };
})();
window.addEventListener('beforeunload',e=>{if(SaveStore.unsaved){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)SaveStore.flush();});
