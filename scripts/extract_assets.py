"""Deterministic crops and white-background extraction from supplied originals.
User-authorized local Pillow/NumPy/SciPy processing; no generative edits.
"""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage
import json

ROOT=Path(__file__).resolve().parents[1]/'assets'
# Coordinates normalized against the original sheet, not a model-generated copy.
SPECS={
 'chrysanthemum':('chrysanthemum.jpg',(0,0,1,1)),
 'wheat':('food.jpg',(.05,.03,.34,.28)),
 'rice':('food.jpg',(.36,.08,.64,.27)),
 'riceball':('food.jpg',(.66,.06,.96,.27)),
 'lunchbox':('food.jpg',(.07,.28,.52,.52)),
 'meal':('food.jpg',(.56,.26,.96,.525)),
 'leaves':('food.jpg',(.06,.52,.32,.71)),
 'teacup':('food.jpg',(.40,.53,.61,.72)),
 'teapot':('food.jpg',(.05,.71,.34,.96)),
 'flowercakes':('food.jpg',(.37,.755,.64,.96)),
 'celebration':('food.jpg',(.66,.65,.96,.96)),
 'frame':('interface.jpg',(.035,.04,.515,.51)),
 'blind':('interface.jpg',(.565,.04,.965,.56)),
 'tray':('interface.jpg',(.025,.55,.52,.95)),
 'coin':('interface.jpg',(.545,.625,.77,.93)),
 'energy':('interface.jpg',(.8,.63,.95,.93)),
 'grandma':('portraits.jpg',(.032,.047,.328,.487)),
 'scholar':('portraits.jpg',(.354,.047,.650,.487)),
 'woman':('portraits.jpg',(.676,.047,.972,.487)),
 'official':('portraits.jpg',(.032,.518,.328,.958)),
 'girl':('portraits.jpg',(.354,.518,.650,.958)),
 'sage':('portraits.jpg',(.676,.518,.972,.958))}

def remove_white(im,holes=False,protect_meal=False):
    rgb=np.asarray(im.convert('RGB')).astype(np.float32)
    low=rgb.min(axis=2)
    # Flood-fill only near-white areas reachable from the outside. This keeps
    # enclosed rice grains, porcelain highlights and hair intact.
    candidates=(low>=100)&((rgb.max(axis=2)-low)<70)
    if protect_meal:
        yy,xx=np.mgrid[:im.height,:im.width]
        inside=((xx/im.width-.584)/.365)**2+((yy/im.height-.627)/.31)**2<1
        candidates[inside]=False
    seeds=np.zeros(candidates.shape,dtype=bool)
    seeds[[0,-1],:]=candidates[[0,-1],:]
    seeds[:,[0,-1]]=candidates[:,[0,-1]]
    bg=ndimage.binary_propagation(seeds,mask=candidates)
    if holes:
        candidates=(low>=233)&((rgb.max(axis=2)-low)<24)
        # Only the frame/coin have intentional white internal cutouts.
        labels,count=ndimage.label(candidates)
        for label in range(1,count+1):
            region=labels==label
            if region.sum()>im.width*im.height*.003:
                bg|=region
    alpha=np.where(bg,0,255).astype(np.uint8)
    rgba=np.dstack((rgb.astype(np.uint8),alpha))
    rgba[alpha==0,:3]=0
    out=Image.fromarray(rgba)
    box=out.getchannel('A').getbbox()
    if not box:raise ValueError('Empty sprite')
    return out.crop(box)

report={}
for name,(file,box) in SPECS.items():
    im=Image.open(ROOT/'source'/file)
    coords=tuple(round(v*(im.width if i%2==0 else im.height)) for i,v in enumerate(box))
    tile=im.crop(coords)
    if file=='portraits.jpg':
        # Keep the provided circular cream portrait, trim only outside its circle.
        tile=tile.convert('RGBA')
        yy,xx=np.mgrid[:tile.height,:tile.width]
        distance=np.sqrt(((xx+.5-tile.width/2)/(tile.width/2))**2+((yy+.5-tile.height/2)/(tile.height/2))**2)
        a=np.clip((1-distance)*min(tile.size)/2,0,1)*255
        tile.putalpha(Image.fromarray(a.astype(np.uint8)))
    else:tile=remove_white(tile,name in ('frame','coin','teapot'),name=='meal')
    tile.save(ROOT/'cutouts'/f'{name}.png',optimize=True)
    report[name]={'source':file,'crop':coords,'width':tile.width,'height':tile.height}
(ROOT/'crop-sources.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(f'Extracted {len(SPECS)} original sprites without redrawing.')
