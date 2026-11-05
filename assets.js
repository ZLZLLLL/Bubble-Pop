/* A single decoded, shared WebP atlas. CSS coordinates work on file:// as well. */
const AssetStore=(()=>{
  const manifest=window.ASSET_MANIFEST;
  const aliases={leaf:'leaves',tea:'teacup',pot:'teapot',sweet:'rice',bun:'riceball',cake:'flowercakes',basket:'lunchbox',teaBasket:'chrysanthemum'};
  const resolved=id=>aliases[id]||id;
  function has(id){return !!manifest?.frames[resolved(id)];}
  function icon(id,cls=''){
    const f=manifest.frames[resolved(id)];
    return `<span class="sprite ${cls}" aria-hidden="true" data-sprite="${resolved(id)}" style="background-position:${f.column/(manifest.columns-1)*100}% ${f.row/(manifest.rows-1)*100}%"></span>`;
  }
  let ready;
  function preload(){
    return ready??=Promise.all([manifest.atlas,manifest.background].map(file=>new Promise(resolve=>{
      const image=new Image();image.decoding='async';image.onload=()=>resolve({file,ok:true});
      image.onerror=()=>resolve({file,ok:false});image.src='assets/'+file;
    })));
  }
  return {has,icon,preload,manifest};
})();
AssetStore.preload().then(results=>{
  if(results.some(r=>!r.ok))document.querySelector('.chapter small').textContent='部分素材未加载，请刷新重试';
});
