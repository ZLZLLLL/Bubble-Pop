const $=s=>document.querySelector(s),icon=(id,cls='')=>AssetStore.has(id)?AssetStore.icon(id,cls):`<svg class="${cls}" aria-hidden="true" viewBox="0 0 80 80"><use href="#${id}"/></svg>`;
const STORAGE='cloud-teahouse-v1';let state=Game.fresh(),selected=null,sound=false,audioContext,toastTimer;
try{const saved=JSON.parse(localStorage.getItem(STORAGE));if(Game.valid(saved))state=saved;}catch{}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{}SaveStore.save(state);}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2600);}
function chime(merge=false){if(!sound)return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();[0,...(merge?[.11]:[])].forEach((t,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=i?880:660;g.gain.setValueAtTime(.045,audioContext.currentTime+t);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+t+.3);o.connect(g);g.connect(audioContext.destination);o.start(audioContext.currentTime+t);o.stop(audioContext.currentTime+t+.31);});}catch{}}
function showModal(content){$('#modal-content').innerHTML=content;if(!$('#modal').open)$('#modal').showModal();}
$('.modal-close').onclick=()=>$('#modal').close();$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')&&!e.target.dataset.busy){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function render(pop=-1){const focused=document.activeElement?.dataset?.index;$('#energy-value').textContent=state.energy;$('#coin-value').textContent=state.coins;$('#gem-value').textContent=state.gems;$('#level-value').textContent=['壹','贰','叁','肆','伍'][Math.min(4,Math.floor(state.served/3))];
$('#board').innerHTML=state.board.map((x,i)=>{const item=Game.items[x];return `<button class="cell${x==='locked'?' locked':''}${selected===i?' selected':''}${pop===i?' pop':''}" data-index="${i}" aria-label="第${Math.floor(i/7)+1}行第${i%7+1}列，${item?.name||(x==='locked'?'竹帘，15铜钱解锁':'空位')}" aria-pressed="${selected===i}">${item?icon(item.icon)+(item.generator?`<span class="source-mark">${item.generator==='rice'?'稻':'茶'}</span>`:`<span class="item-level">${item.level}</span>`):x==='locked'?icon('blind','blind-sprite'):''}</button>`;}).join('');
$('#orders').innerHTML=state.orders.map((id,i)=>{const o=Game.orders[id],ready=Game.canServe(state,i);return `<div class="order${ready?' order-ready':''}" data-order="${i}" tabindex="0" role="group" aria-label="${o.name}的订单：${o.needs.map(n=>Game.items[n].name).join('、')}，奖励${o.reward}铜钱。${ready?'拖入所需物品交付':'集齐后拖入交付'}">${icon(['grandma','scholar','woman','official','girl','sage'][id%6],'patron')}<span class="order-name">${o.name}</span><div class="tray">${icon('tray','tray-art')}${o.needs.map(n=>icon(Game.items[n].icon)).join('')}<span class="order-reward">${icon('coin')}${o.reward}</span></div><span class="order-hint">${ready?'拖入交付':'集齐后拖入'}</span></div>`;}).join('');
const item=Game.items[state.board[selected]];$('#detail-icon').innerHTML=icon(item?.icon||'basket');$('#detail-title').textContent=item?.name||'一篮好食，静候有缘人';$('#detail-text').textContent=item?(item.next?`与另一件${item.name}合成${Game.items[item.next].name}`:item.generator?`${item.generator==='rice'?'只出稻谷 · 稻米链':'只出茶叶 · 茶点链'} · 每次 1 体力`:'已达最高等级，可用于交付顾客订单'):'稻米与茶点独立出物 · 拖至托盘交付';save();if(focused!==undefined)document.querySelector('[data-index="'+focused+'"]').focus({preventScroll:true});}
function produce(chain){const r=Game.produce(state,chain);if(!r.ok)return toast(r.message);selected=null;render(r.index);chime();}
function transfer(a,b){const r=Game.move(state,a,b);if(!r.ok){if(r.max)toast('这件好物已达最高级，可以交付订单');return;}selected=b;render(b);if(r.merged){toast(`合成成功 · ${Game.items[r.item].name}`);chime(true);}else chime();}
function select(i){const x=state.board[i];if(x==='locked'){const r=Game.unlock(state,i);if(r.ok){toast('竹帘轻启，多一方天地 · −15 铜钱');render(i);chime();}else toast(r.message);return;}if(Game.items[x]?.generator){produce(Game.items[x].generator);return;}if(selected!==null&&selected!==i&&Game.items[state.board[selected]]){transfer(selected,i);return;}selected=selected===i?null:(x?i:null);render();}
$('#board').addEventListener('click',e=>{if(suppressClick){suppressClick=false;return;}const cell=e.target.closest('[data-index]');if(cell)select(Number(cell.dataset.index));});
let drag=null,ghost=null,suppressClick=false;
function clearDrag(){
 document.querySelectorAll('.drag-source,.drop-ready,.drop-blocked').forEach(el=>el.classList.remove('drag-source','drop-ready','drop-blocked'));
 if(drag&&$('#board').hasPointerCapture(drag.pointer))$('#board').releasePointerCapture(drag.pointer);
 ghost?.remove();ghost=null;drag=null;
}
function deliverOrder(order,source){
 const r=Game.deliver(state,order,source);if(!r.ok){toast(r.message);return;}
 selected=null;render();toast(`客人心满意足 · +${r.reward} 铜钱`);chime(true);
}
$('#board').addEventListener('pointerdown',e=>{
 if(drag||$('.game').inert)return;const cell=e.target.closest('[data-index]');if(!cell||e.button!==0)return;
 const i=Number(cell.dataset.index);if(!Game.items[state.board[i]])return;
 drag={index:i,x:e.clientX,y:e.clientY,moving:false,pointer:e.pointerId,size:cell.getBoundingClientRect().width};

});
window.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.pointer)return;
 if(!drag.moving&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7){
  drag.moving=true;$('#board').setPointerCapture(e.pointerId);ghost=document.createElement('div');ghost.className='drag-ghost';ghost.style.width=ghost.style.height=drag.size+'px';
  ghost.innerHTML=icon(Game.items[state.board[drag.index]].icon);document.body.append(ghost);
  document.querySelector(`[data-index="${drag.index}"]`).classList.add('drag-source');
 }
 if(!ghost)return;ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';
 document.querySelectorAll('.drop-ready,.drop-blocked').forEach(el=>el.classList.remove('drop-ready','drop-blocked'));
 const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-order]');
 if(target){const i=Number(target.dataset.order),valid=Game.orders[state.orders[i]].needs.includes(state.board[drag.index])&&Game.canServe(state,i);target.classList.add(valid?'drop-ready':'drop-blocked');}
});
window.addEventListener('pointerup',e=>{
 if(!drag||e.pointerId!==drag.pointer)return;
 const moving=drag.moving,source=drag.index,target=document.elementFromPoint(e.clientX,e.clientY);
 clearDrag();if(!moving||$('.game').inert)return;
 suppressClick=true;setTimeout(()=>suppressClick=false,0);
 const order=target?.closest('[data-order]'),cell=target?.closest('[data-index]');
 if(order)deliverOrder(Number(order.dataset.order),source);else if(cell)transfer(source,Number(cell.dataset.index));
});
window.addEventListener('pointercancel',clearDrag);
window.addEventListener('blur',clearDrag);
window.addEventListener('keydown',e=>{if(e.key==='Escape')clearDrag();});
$('#orders').addEventListener('keydown',e=>{
 if(e.key!=='Enter'&&e.key!==' ')return;
 const order=e.target.closest('[data-order]');if(!order)return;e.preventDefault();
 if(selected===null)return toast('先用键盘选择一件订单物品');
 deliverOrder(Number(order.dataset.order),selected);
});
$('#produce-rice').onclick=()=>produce('rice');
$('#produce-tea').onclick=()=>produce('tea');
$('#help').onclick=()=>showModal(`<p class="dialog-kicker">小铺入门</p><h2>一合一味，慢慢来</h2><ul><li><b>取食材：</b>稻米篓只出稻谷，茶点篮只出茶叶；点击棋盘上的生成器或下方对应按钮，每次消耗 1 点体力。</li><li><b>合成好物：</b>把相同物品拖到一起；也可先点一件，再点另一件。不同物品会交换位置。</li><li><b>招待客人：</b>集齐上方订单，将其中一件所需物品拖到顾客托盘，一次交付整单赚取铜钱。</li><li><b>扩大小铺：</b>点击与已开放格子相邻的竹帘，花 15 铜钱解锁。</li><li><b>补充体力：</b>点击体力旁的 + 或「兑换体力」，输入兑换码领取。</li></ul><p>进度自动保存到服务器。键盘可先选中物品，再 Tab 到顾客并按 Enter 交付。</p>`);
$('#guide').onclick=()=>showModal(`<p class="dialog-kicker">山野好物集</p><h2>物品图鉴</h2><p>两件相同好物合成下一阶，两条链独立升级。按顾客需求交付对应物品。</p>${Object.entries(Game.chains).map(([key,chain])=>`<h3 class="chain-title">${key==='rice'?'稻米链':'茶点链'}</h3><div class="catalog-row">${chain.map((x,i)=>`<div class="catalog-item">${icon(Game.items[x].icon)}<small>Lv.${i+1}</small>${Game.items[x].name}</div>`).join('')}</div>`).join('')}`);
function openRedeem(){
 showModal(`<p class="dialog-kicker">把心意，换成好元气</p><h2>兑换体力</h2><p>输入兑换码，为小铺补充体力。每个兑换码仅可领取一次。</p><form id="redeem-form"><label for="redeem-code">兑换码</label><input id="redeem-code" name="code" autocomplete="off" placeholder="请输入兑换码" maxlength="100" required><p id="redeem-error" class="form-error" role="alert"></p><button class="modal-action" type="submit">领取体力</button></form>`);
 $('#redeem-code').focus();
 $('#redeem-form').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget,button=form.querySelector('button'),error=$('#redeem-error');
  button.disabled=true;button.textContent='兑换中…';error.textContent='';$('.game').inert=true;
  const modal=$('#modal'),closeButton=$('.modal-close');closeButton.disabled=true;const blockClose=e=>e.preventDefault();modal.addEventListener('cancel',blockClose);modal.dataset.busy='true';
  try{const result=await SaveStore.redeem(form.elements.code.value.trim());state=result.state;selected=null;render();modal.close();toast(`心意已收下 · +${result.energy} 体力`);chime(true);}
  catch(e){error.textContent=e.message||'兑换失败，请稍后重试';}
  finally{button.disabled=false;button.textContent='领取体力';closeButton.disabled=false;modal.removeEventListener('cancel',blockClose);delete modal.dataset.busy;if(!document.body.classList.contains('signed-out')&&!$('.chapter small').textContent.includes('请刷新'))$('.game').inert=false;}
 };
}
$('#daily').onclick=openRedeem;$('#add-energy').onclick=openRedeem;
$('#account').onclick=()=>{
 showModal('<p class="dialog-kicker">山间小铺 · 我的账号</p><h2>你好，lulu</h2><p>进度会保存在小铺，下次登录可以继续。</p><p id="logout-error" class="form-error" role="alert"></p><button class="modal-action" id="logout">保存并退出登录</button>');
 $('#logout').onclick=async()=>{const button=$('#logout');button.disabled=true;$('.game').inert=true;try{await SaveStore.settle();await Auth.logout();}catch(e){$('#logout-error').textContent=e.message;button.disabled=false;$('.game').inert=false;}};
};
$('#level').onclick=()=>showModal(`<p class="dialog-kicker">小铺成长记</p><h2>${['初逢小铺','茶香渐起','熟客盈门','山间名铺','云间佳话'][Math.min(4,Math.floor(state.served/3))]}</h2><p>已经招待 <b>${state.served}</b> 位客人，完成 <b>${state.merged}</b> 次合成。<br>${state.served<12?`再完成 ${3-state.served%3} 个订单，小铺就能升一级。`:'小铺已升至最高等级，继续享受山间清欢吧。'}</p>`);
$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent=`音效 · ${sound?'开':'关'}`;$('#sound').setAttribute('aria-label',sound?'关闭音效':'开启音效');chime();};
async function boot(){
 $('.game').inert=true;$('.chapter small').textContent='正在读取服务器存档…';
 try{await Auth.ready();const remote=await SaveStore.load();if(remote){if(!Game.valid(remote))throw new Error('Invalid server save');state=remote;}state=Game.migrate(state);render();$('.game').inert=false;}
 catch{showModal('<h2>暂时无法读取存档</h2><p>请确认服务器正常运行，然后刷新重试。为避免覆盖进度，暂不进入游戏。</p><button class="modal-action" onclick="location.reload()">重新加载</button>');}
}
boot();

document.querySelectorAll('.resource svg').forEach(el=>{const id=el.querySelector('use')?.getAttribute('href')?.slice(1);if(AssetStore.has(id))el.outerHTML=icon(id);});
