const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {openStore}=require('./storage.cjs');
function createApp({dataDir=process.env.DATA_DIR||path.join(__dirname,'data'),publicDir=path.join(__dirname,'public'),secureCookie=process.env.COOKIE_SECURE==='true'}={}){
 const store=openStore(path.join(dataDir,'game.sqlite')),attempts=new Map();
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const cookie=(token,clear=false)=>'teahouse_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+(clear?0:604800)+(secureCookie?'; Secure':'');
 async function body(req){
  if(!(req.headers['content-type']||'').startsWith('application/json'))throw Object.assign(new Error('请使用 JSON 请求'),{status:415});
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>32768)throw Object.assign(new Error('请求过大'),{status:413});chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  let url;try{url=new URL(req.url,'http://local');}catch{return json(res,400,{error:'Invalid URL'});}
  if(url.pathname==='/healthz')return json(res,200,{ok:true});
  const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('teahouse_session='))?.slice(17);
  if(url.pathname.startsWith('/api/')){
   try{
    if(!['GET','HEAD'].includes(req.method)){
     if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'请求来源不匹配'});
     if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'请求来源不匹配'});}catch{return json(res,403,{error:'请求来源不匹配'});}}
    }
    if(url.pathname==='/api/login'&&req.method==='POST'){
     const key=req.socket.remoteAddress,now=Date.now();for(const [ip,r] of attempts)if(r.until<now)attempts.delete(ip);
     const rate=attempts.get(key)||{count:0,until:now+60000};if(rate.count>=10)return json(res,429,{error:'尝试次数过多，请一分钟后再试'});
     const input=await body(req);rate.count++;attempts.set(key,rate);const result=store.login(input.username,input.password);attempts.delete(key);
     store.logout(token);res.setHeader('Set-Cookie',cookie(result.token));return json(res,200,{username:result.username});
    }
    const user=store.session(token);if(!user)return json(res,401,{error:'请先登录'});
    if(url.pathname==='/api/session'&&req.method==='GET')return json(res,200,{username:user.username});
    if(url.pathname==='/api/logout'&&req.method==='POST'){store.logout(token);res.setHeader('Set-Cookie',cookie('',true));return json(res,200,{ok:true});}
    if(url.pathname==='/api/save'){
     if(req.method==='GET')return json(res,200,store.read());
     if(req.method==='PUT'){const input=await body(req);return json(res,200,store.write(input.state,input.revision));}
     return json(res,405,{error:'Method not allowed'});
    }
    if(url.pathname==='/api/redeem'&&req.method==='POST'){const input=await body(req);return json(res,200,store.redeem(user.id,input.code,input.revision));}
    return json(res,404,{error:'Not found'});
   }catch(e){return json(res,e.status||400,{error:e.status?e.message:'请求格式不正确'});}
  }
  if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
  let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return json(res,400,{error:'Invalid path'});}
  const file=path.resolve(publicDir,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(publicDir+path.sep))return json(res,403,{error:'Forbidden'});
  fs.readFile(file,(err,data)=>{if(err)return json(res,404,{error:'Not found'});
   const type={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',svg:'image/svg+xml',webp:'image/webp',png:'image/png',json:'application/json'}[path.extname(file).slice(1)]||'application/octet-stream';
   res.setHeader('Content-Type',type);res.setHeader('Cache-Control',/\.[a-f0-9]{12}\.webp$/.test(file)?'public, max-age=31536000, immutable':'no-cache');res.end(req.method==='HEAD'?undefined:data);
  });
 });
 server.on('close',()=>store.close());return server;
}
if(require.main===module){
 if(!fs.existsSync(path.join(__dirname,'public/index.html'))){console.error('Run npm run build first.');process.exit(1);}
 const server=createApp();server.listen(Number(process.env.PORT)||5188,process.env.HOST||'127.0.0.1',()=>console.log('Cloud Teahouse listening on port '+(process.env.PORT||5188)));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
module.exports={createApp};
