const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const publicDir=path.join(root,'public');fs.mkdirSync(path.join(publicDir,'assets'),{recursive:true});
for(const file of ['index.html','style.css','assets-theme.css','game.js','app.js','assets.js','persistence.js','auth.js'])fs.copyFileSync(path.join(root,file),path.join(publicDir,file));
const m=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json')));
for(const file of ['atlas.css','manifest.js','manifest.json',m.atlas,m.background,...(m.extraAtlases||[])])fs.copyFileSync(path.join(root,'assets',file),path.join(publicDir,'assets',file));
console.log('Built public/ with runtime assets only.');
