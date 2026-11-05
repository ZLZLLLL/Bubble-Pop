const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path');
const Game=require('./game.js');
function openStore(filename){
 fs.mkdirSync(path.dirname(filename),{recursive:true});
 const db=new DatabaseSync(filename);
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS saves (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL, revision INTEGER NOT NULL, updated TEXT NOT NULL)');
 return {
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
