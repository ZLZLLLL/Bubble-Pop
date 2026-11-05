const Auth=(()=>{
 const screen=document.querySelector('#login-screen'),form=document.querySelector('#login-form'),error=document.querySelector('#login-error');
 let resume,expired=false;
 async function api(path,body){
  const r=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});
  const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error||'请求失败'),{status:r.status});return data;
 }
 function show(){screen.hidden=false;document.body.classList.add('signed-out');document.querySelector('.game').inert=true;document.querySelector('#login-name').focus();}
 function accept(user){document.querySelector('#account-name').textContent=user.username;screen.hidden=true;document.body.classList.remove('signed-out');}
 form.addEventListener('submit',async e=>{
  e.preventDefault();const button=form.querySelector('button');button.disabled=true;button.textContent='正在开门…';error.textContent='';
  try{const user=await api('/api/login',{username:form.elements.username.value.trim(),password:form.elements.password.value});form.elements.password.value='';accept(user);if(expired)location.reload();else resume?.(user);}
  catch(e){error.textContent=e.message==='Failed to fetch'?'连接失败，请稍后重试':e.message;}
  finally{button.disabled=false;button.textContent='进入小铺';}
 });
 return {
  async ready(){try{const user=await api('/api/session');accept(user);return user;}catch(e){if(e.status!==401)error.textContent='暂时连接不上小铺，请稍后尝试登录';show();return new Promise(resolve=>resume=resolve);}},
  expired(){expired=true;error.textContent='登录已过期，请重新登录';document.querySelector('#modal').close();show();},
  async logout(){await api('/api/logout',{});location.reload();}
 };
})();
