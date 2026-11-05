"""Crop user-supplied sheets, remove exterior white, and build an extension atlas.
Usage: python scripts/extend_assets.py [directory containing the four source PNGs]
Requires Pillow, NumPy and SciPy. Originals/cutouts remain outside runtime assets.
"""
from pathlib import Path
import hashlib, io, json, shutil, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT / 'source'
SHEETS = [
 ('20ead581-6e26-4a6e-a253-b5075a3c6836.png', 'dessert', 7, 2),
 ('00bc6d87-a0ed-463d-8acb-385861076690.png', 'dessert', 17, 1),
 ('a5d8c3d3-afe3-4489-9cdd-e6805d13b213.png', 'grain', 6, 2),
 ('1e3eb54a-b0c9-4581-b1d5-7c2dffd2f24d.png', 'grain', 16, 1),
]
CELL, COLS, ROWS = 192, 5, 6
CUTS = [
 [[0,315,585,893,1186,1536], [0,310,582,890,1185,1536]],
 [[0,454,859,1300,1713,2172]],
 [[0,351,687,1047,1391,1774], [0,350,687,1022,1381,1774]],
 [[0,412,829,1230,1669,2172]],
]
atlas = Image.new('RGBA', (CELL*COLS, CELL*ROWS))
frames = {}
preview = Image.new('RGB', atlas.size, '#506b58')
for sheet_index, (filename, prefix, start, rows) in enumerate(SHEETS):
    path = SOURCE / filename
    (OUT/'source').mkdir(exist_ok=True)
    if path.resolve() != (OUT/'source'/filename).resolve():
        shutil.copy2(path, OUT/'source'/filename)
    sheet = Image.open(path).convert('RGB')
    for index in range(rows*5):
        col, row = index%5, index//5
        bounds = (CUTS[sheet_index][row][col], round(row*sheet.height/rows),
                  CUTS[sheet_index][row][col+1], round((row+1)*sheet.height/rows))
        tile = sheet.crop(bounds)
        rgb = np.asarray(tile).astype(float)
        low, high = rgb.min(axis=2), rgb.max(axis=2)
        # Only exterior-connected near-white is background: white rice and
        # porcelain enclosed by outlines stay opaque. Preserve colored steam.
        candidate = (low > 239) & ((high-low) < 13)
        seed = np.zeros(candidate.shape, bool)
        seed[0,:]=candidate[0,:]; seed[-1,:]=candidate[-1,:]
        seed[:,0]=candidate[:,0]; seed[:,-1]=candidate[:,-1]
        exterior = ndimage.binary_propagation(seed, mask=candidate)
        alpha = np.full(candidate.shape, 255, dtype=np.uint8)
        alpha[exterior] = 0
        # Reject slivers from a neighbouring sprite crossing the crop edge.
        labels, count = ndimage.label(alpha > 0)
        sizes = np.bincount(labels.ravel()); sizes[0] = 0
        main = sizes.argmax()
        edge_labels = set(labels[:,:12].ravel()) | set(labels[:,-12:].ravel())
        for label in edge_labels:
            if label != main: alpha[labels == label] = 0
        rgba = np.dstack((rgb.astype(np.uint8), alpha))
        tile = Image.fromarray(rgba).crop(Image.fromarray(alpha).getbbox())
        name = f'{prefix}{start+index:02d}'
        (OUT/'cutouts').mkdir(exist_ok=True)
        tile.save(OUT/'cutouts'/f'{name}.png')
        tile.thumbnail((176,176), Image.Resampling.LANCZOS)
        n=len(frames); x,y=(n%COLS)*CELL,(n//COLS)*CELL
        atlas.alpha_composite(tile,(x+(CELL-tile.width)//2,y+(CELL-tile.height)//2))
        frames[name]={'x':x,'y':y,'width':CELL,'height':CELL,'column':n%COLS,
                      'row':n//COLS,'columns':COLS,'rows':ROWS,'sourceCrop':list(bounds)}
buffer=io.BytesIO()
atlas.save(buffer,format='WEBP',quality=86,method=6,alpha_quality=100)
data=buffer.getvalue()
filename=f'extensions.{hashlib.sha256(data).hexdigest()[:12]}.webp'
(OUT/filename).write_bytes(data)
manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf8'))
for frame in frames.values(): frame['atlas']=filename
manifest['frames'].update(frames)
manifest['extraAtlases']=[filename]
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'manifest.js').write_text('window.ASSET_MANIFEST='+json.dumps(manifest,ensure_ascii=False)+';\n',encoding='utf8')
preview.paste(atlas,mask=atlas.getchannel('A'))
draw=ImageDraw.Draw(preview)
for name,frame in frames.items(): draw.text((frame['x']+8,frame['y']+178),name,fill='white')
(ROOT/'output').mkdir(exist_ok=True)
preview.save(ROOT/'output'/'extensions-preview.jpg')
print(f'{len(frames)} sprites; {filename}; {len(data):,} bytes')
