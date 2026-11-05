const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {openStore}=require('./storage.cjs');
function createApp({dataDir=process.env.DATA_DIR||path.join(__dirname,'data'),password=process.env.ACCESS_PASSWORD||'',publicDir=path.join(__dirname,'public')}={}){
 const store=openStore(path.join(dataDir,'game.sqlite'));
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  const url=new URL(req.url,'http://local');
  if(url.pathname==='/healthz')return json(res,200,{ok:true});
  if(password){let credential='';try{credential=Buffer.from((req.headers.authorization||'').replace(/^Basic /,''),'base64').toString();}catch{}
   const expected=crypto.createHash('sha256').update('player:'+password).digest();const actual=crypto.createHash('sha256').update(credential).digest();
   if(!crypto.timingSafeEqual(expected,actual)){res.setHeader('WWW-Authenticate','Basic realm="Cloud Teahouse", charset="UTF-8"');return json(res,401,{error:'Authentication required'});}
  }
  if(url.pathname==='/api/save'){
   if(req.method==='GET')return json(res,200,store.read());
   if(req.method!=='PUT')return json(res,405,{error:'Method not allowed'});
   if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Origin rejected'});}catch{return json(res,403,{error:'Origin rejected'});}}
   if(!(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'JSON required'});
   try{let body='',bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>32768)return json(res,413,{error:'Save too large'});body+=chunk.toString();}const input=JSON.parse(body);return json(res,200,store.write(input.state,input.revision));}
   catch(e){return json(res,e.status||400,{error:e.status===409?e.message:'Invalid save'});}
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
 if(!process.env.ACCESS_PASSWORD&&process.env.ALLOW_INSECURE!=='1'){console.error('Set ACCESS_PASSWORD, or ALLOW_INSECURE=1 for local testing.');process.exit(1);}
 if(!fs.existsSync(path.join(__dirname,'public/index.html'))){console.error('Run npm run build first.');process.exit(1);}
 const server=createApp();server.listen(Number(process.env.PORT)||5188,process.env.HOST||'127.0.0.1',()=>console.log('Cloud Teahouse listening on port '+(process.env.PORT||5188)));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
module.exports={createApp};
