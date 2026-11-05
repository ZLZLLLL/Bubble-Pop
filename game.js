(function(root){
const chains={rice:['wheat','sweet','bun','lunch','meal'],tea:['leaf','tea','pot','chrysanthemum','cake','celebration']};
const items={
 wheat:{name:'金黄稻谷',icon:'wheat',next:'sweet',level:1},sweet:{name:'一碟香米',icon:'sweet',next:'bun',level:2},bun:{name:'竹叶饭团',icon:'bun',next:'lunch',level:3},lunch:{name:'竹笼便当',icon:'lunchbox',next:'meal',level:4},meal:{name:'山野盛宴',icon:'meal',level:5},
 leaf:{name:'初春茶叶',icon:'leaf',next:'tea',level:1},tea:{name:'一盏清茶',icon:'tea',next:'pot',level:2},pot:{name:'紫砂茶壶',icon:'pot',next:'chrysanthemum',level:3},chrysanthemum:{name:'菊花清饮',icon:'chrysanthemum',next:'cake',level:4},cake:{name:'桃花酥',icon:'cake',next:'celebration',level:5},celebration:{name:'花朝庆糕',icon:'celebration',level:6},
 basket:{name:'稻米篓',icon:'basket',generator:'rice',level:0},teaBasket:{name:'茶点篮',icon:'teaBasket',generator:'tea',level:0}
};
// Append-only IDs keep existing boards and order indices compatible.
const extensions={
 rice:['香煎米饼','竹筒香饭','五彩米卷','荷叶糯米饭','海鲜焖饭','五谷丰登','菌菇砂锅饭','翡翠玉米盅','蟹黄金炒饭','山河稻香','金鼎御膳','青玉五谷鼎','瑞穗丰年','五彩如意饭','金穗莲华宴'],
 tea:['桃花蒸糕','琉璃花冻','三色花糕','流霞晶冻','花瓷茶宴','锦盒花酥','双层花点','天鹅莲露','青瓷花团','月下琼糕','金笼百花糕','三重花宴','莲华凝露','凤舞月华','天宫百花宴']
};
for(const [key,names] of Object.entries(extensions)){
 for(const name of names){
  const chain=chains[key],level=chain.length+1,id=(key==='rice'?'grain':'dessert')+String(level).padStart(2,'0');
  items[chain.at(-1)].next=id;items[id]={name,icon:id,level};chain.push(id);
 }
}
const orders=[{name:'邻家阿婆',avatar:'cat',needs:['tea','tea'],reward:18},{name:'青衫客',avatar:'guest',needs:['cake'],reward:28},{name:'采茶姑娘',avatar:'guest',needs:['bun','tea'],reward:24},{name:'游山客',avatar:'guest',needs:['pot'],reward:32},{name:'小山灵',avatar:'cat',needs:['bun','bun'],reward:24},{name:'山中故人',avatar:'guest',needs:['pot','cake'],reward:60}];
const baseOrderCount=orders.length;
for(const chain of Object.values(chains))for(const id of chain){
 if(!id.startsWith('grain')&&!id.startsWith('dessert'))continue;
 orders.push({name:'寻味客',avatar:'guest',needs:[id],reward:items[id].level*20});
}
function nextOrder(s,index){
 // Only request an advanced item already on the board; never block a new
 // player with an unreachable high-tier order. Other slots keep their orders.
 const available=orders.map((o,id)=>id).filter(id=>id>=baseOrderCount&&id!==s.orders[index]&&!s.orders.includes(id)&&orders[id].needs.every(item=>s.board.includes(item)));
 return available.length?available[(s.served-1)%available.length]:(s.orders[index]+3)%baseOrderCount;
}
function fresh(){const board=Array(49).fill(null);const initial={0:'leaf',1:'leaf',2:'tea',3:'sweet',4:'sweet',7:'bun',8:'teaBasket',9:'tea',10:'leaf',14:'sweet',16:'basket',18:'bun',21:'leaf',22:'sweet',25:'tea',28:'bun',30:'leaf',31:'sweet',33:'leaf',36:'sweet',37:'leaf'};for(const [i,v] of Object.entries(initial))board[i]=v;[5,6,12,13,20,27,34,40,41,42,43,44,45,46,47,48].forEach(i=>board[i]='locked');return{version:1,board,energy:100,coins:60,gems:12,served:0,merged:0,orders:[0,1,2],daily:null};}
function valid(s){return s&&s.version===1&&Array.isArray(s.board)&&s.board.length===49&&s.board.every(x=>x===null||x==='locked'||Object.hasOwn(items,x))&&s.board.filter(x=>x==='basket').length===1&&s.board.filter(x=>x==='teaBasket').length<=1&&['energy','coins','gems','served','merged'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0&&s[k]<=1000000000)&&(s.daily===null||(typeof s.daily==='string'&&/^\d{4}-\d{1,2}-\d{1,2}$/.test(s.daily)))&&Array.isArray(s.orders)&&s.orders.length===3&&s.orders.every(x=>Number.isInteger(x)&&orders[x]);}
function move(s,a,b){if(a===b||!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>48||b>48)return{ok:false};const x=s.board[a],y=s.board[b];if(!items[x]||y==='locked')return{ok:false};if(x===y&&items[x].next){s.board[b]=items[x].next;s.board[a]=null;s.merged++;return{ok:true,merged:true,item:s.board[b]};}if(x===y)return{ok:false,max:true};[s.board[a],s.board[b]]=[y,x];return{ok:true};}
function produce(s,chain='rice'){
 if(!Object.hasOwn(chains,chain))return{ok:false,message:'请选择稻米篓或茶点篮'};
 if(s.energy<1)return{ok:false,message:'体力不足，点上方 + 补充体力'};
 const empty=s.board.indexOf(null);if(empty<0)return{ok:false,message:'棋盘满啦，先合成或交付一些物品吧'};
 s.board[empty]=chains[chain][0];s.energy--;return{ok:true,index:empty};
}
function migrate(s){
 if(!s.board.includes('teaBasket')){let slot=s.board.indexOf(null);if(slot<0)slot=s.board.lastIndexOf('locked');if(slot>=0)s.board[slot]='teaBasket';}
 return s;
}
function canServe(s,index){const need=orders[s.orders[index]].needs;const copy=[...s.board];return need.every(x=>{const i=copy.indexOf(x);if(i<0)return false;copy[i]=null;return true;});}
function serve(s,index){if(!canServe(s,index))return{ok:false};const order=orders[s.orders[index]];order.needs.forEach(x=>s.board[s.board.indexOf(x)]=null);s.coins+=order.reward;s.served++;s.orders[index]=nextOrder(s,index);return{ok:true,reward:order.reward};}
function deliver(s,index,source){
 if(!Number.isInteger(index)||index<0||index>=s.orders.length||!Number.isInteger(source)||source<0||source>=s.board.length)return{ok:false,message:'请拖入订单需要的物品'};
 const order=orders[s.orders[index]],item=s.board[source],needs=[...order.needs],position=needs.indexOf(item);
 if(position<0)return{ok:false,message:'这位客人不需要这件物品'};
 if(!canServe(s,index))return{ok:false,message:'先集齐托盘中的物品，再拖入交付'};
 needs.splice(position,1);s.board[source]=null;
 needs.forEach(x=>s.board[s.board.indexOf(x)]=null);
 s.coins+=order.reward;s.served++;s.orders[index]=nextOrder(s,index);
 return{ok:true,reward:order.reward};
}
function unlock(s,i){if(s.board[i]!=='locked')return{ok:false};if(s.coins<15)return{ok:false,message:'还差一些铜钱，完成订单就能赚取'};if(![i%7>0?i-1:-1,i%7<6?i+1:-1,i-7,i+7].some(n=>n>=0&&n<49&&s.board[n]!=='locked'))return{ok:false,message:'先解锁与空地相邻的竹帘吧'};s.coins-=15;s.board[i]=null;return{ok:true};}
const api={items,chains,orders,fresh,valid,migrate,move,produce,canServe,serve,deliver,unlock};if(typeof module!=='undefined')module.exports=api;else root.Game=api;
})(globalThis);
