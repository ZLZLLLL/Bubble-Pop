const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path');
const Game=require('./game.js');
const crypto=require('node:crypto');
const CODES=new Map([['喜欢乐乐',20],['抱抱乐乐',50],['亲亲乐乐',60]]);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const tokenHash=token=>crypto.createHash('sha256').update(token).digest('hex');
function openStore(filename){
 fs.mkdirSync(path.dirname(filename),{recursive:true});
 const db=new DatabaseSync(filename);
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS saves (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL, revision INTEGER NOT NULL, updated TEXT NOT NULL)');
 db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS redemptions(user_id INTEGER NOT NULL, code TEXT NOT NULL, energy INTEGER NOT NULL, redeemed_at TEXT NOT NULL, PRIMARY KEY(user_id,code));`);
 if(!db.prepare('SELECT id FROM users WHERE id=1').get()){
  let salt='37113897cf973460b07d7fa6a1b0d459',hash='fcdc64b60fe8e3781d0179ae741d376b923f4e976ebf10678072b44df9d8bf948d87b6f76eb9dd7f76258d4a4bf151fe4a7225f5ca95c04295734a340c4bd9f6';
  if(process.env.INITIAL_PASSWORD){salt=crypto.randomBytes(16).toString('hex');hash=crypto.scryptSync(process.env.INITIAL_PASSWORD,salt,64).toString('hex');}
  db.prepare('INSERT OR IGNORE INTO users VALUES(1,?,?,?)').run('lulu',salt,hash);
 }
 return {
  login(username,password){
   if(typeof username!=='string'||typeof password!=='string'||password.length>256)throw fail('账号或密码不正确',401);
   const user=db.prepare('SELECT * FROM users WHERE id=1').get();
   const hash=crypto.scryptSync(password,user.salt,64);
   if(!crypto.timingSafeEqual(hash,Buffer.from(user.password_hash,'hex'))||username.trim()!==user.username)throw fail('账号或密码不正确',401);
   const token=crypto.randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
   db.prepare('INSERT INTO sessions VALUES(?,1,?)').run(tokenHash(token),Date.now()+7*86400000);
   return {token,username:user.username};
  },
  session(token){if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;return db.prepare('SELECT users.id,users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>?').get(tokenHash(token),Date.now())||null;},
  logout(token){if(typeof token==='string')db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));},
  redeem(userId,code,revision){
   if(userId!==1||typeof code!=='string'||code.length>100)throw fail('请输入有效兑换码');
   code=code.trim();const energy=CODES.get(code);if(!energy)throw fail('兑换码不正确，请检查后重试');
   db.exec('BEGIN IMMEDIATE');
   try{
    if(db.prepare('SELECT 1 FROM redemptions WHERE user_id=? AND code=?').get(userId,code))throw fail('这个兑换码已经领取过了',422);
    const old=this.read();if(old.revision!==revision)throw fail('存档已更新，请刷新后兑换',409);
    const state=old.state||Game.fresh();state.energy+=energy;if(!Game.valid(state))throw fail('体力已达上限');
    const updated=new Date().toISOString();db.prepare('INSERT INTO redemptions VALUES(?,?,?,?)').run(userId,code,energy,updated);
    db.prepare('INSERT INTO saves VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,revision=excluded.revision,updated=excluded.updated').run(JSON.stringify(state),revision+1,updated);
    db.exec('COMMIT');return {state,revision:revision+1,energy,updated};
   }catch(e){db.exec('ROLLBACK');throw e;}
  },
  read(){const r=db.prepare('SELECT * FROM saves WHERE id=1').get();return r?{state:JSON.parse(r.state),revision:r.revision,updated:r.updated}:{state:null,revision:0};},
  write(state,revision){
   if(!Game.valid(state)||!Number.isSafeInteger(revision)||revision<0)throw Object.assign(new Error('Invalid save'),{status:400});
   db.exec('BEGIN IMMEDIATE');
   try {const old=this.read();if(old.revision!==revision)throw Object.assign(new Error('Save changed in another tab; reload first'),{status:409});
    const updated=new Date().toISOString();db.prepare('INSERT INTO saves VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,revision=excluded.revision,updated=excluded.updated').run(JSON.stringify(state),revision+1,updated);
    db.exec('COMMIT');return {revision:revision+1,updated};
   }catch(e){db.exec('ROLLBACK');throw e;}
  },close(){db.close();}
 };
}
module.exports={openStore};
