"""Pack the background-extracted master into a versioned runtime atlas.
Usage: python scripts/build_assets.py assets/source/transparent-master.png
Requires Pillow. Originals and lossless cutouts are never loaded by the game.
"""
from pathlib import Path
from PIL import Image
import hashlib, json, sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
NAMES = ['chrysanthemum','wheat','rice','riceball','lunchbox','meal',
         'leaves','teacup','teapot','flowercakes','celebration','frame',
         'blind','tray','coin','energy','grandma','scholar',
         'woman','official','girl','sage']
COLS, ROWS, CELL = 6, 4, 192
from_cutouts = sys.argv[1] == '--cutouts'
source = None if from_cutouts else Image.open(sys.argv[1]).convert('RGBA')
if source:
    alpha_histogram = source.getchannel('A').histogram()
    if sum(alpha_histogram[:8]) < source.width*source.height*.15:
        raise ValueError('Master must contain fully transparent gutters; a semiopaque white wash is not a valid cutout')
atlas = Image.new('RGBA', (COLS*CELL, ROWS*CELL))
frames = {}
for i, name in enumerate(NAMES):
    col, row = i % COLS, i // COLS
    bounds = () if from_cutouts else (round(col*source.width/COLS), round(row*source.height/ROWS),
              round((col+1)*source.width/COLS), round((row+1)*source.height/ROWS))
    tile = Image.open(OUT/'cutouts'/f'{name}.png').convert('RGBA') if from_cutouts else source.crop(bounds)
    box = tile.getchannel('A').getbbox()
    if not box:
        raise ValueError(f'Missing sprite: {name}')
    tile = tile.crop(box)
    if not from_cutouts:tile.save(OUT/'cutouts'/f'{name}.png', optimize=True)
    tile.thumbnail((CELL-16, CELL-16), Image.Resampling.LANCZOS)
    x, y = col*CELL+(CELL-tile.width)//2, row*CELL+(CELL-tile.height)//2
    atlas.alpha_composite(tile, (x,y))
    frames[name] = {'x':col*CELL,'y':row*CELL,'width':CELL,'height':CELL,
                    'column':col,'row':row,'sourceCrop':list(bounds)}

def save_versioned(image, prefix, **options):
    import io
    buffer = io.BytesIO()
    image.save(buffer, format='WEBP', **options)
    data = buffer.getvalue()
    filename = f'{prefix}.{hashlib.sha256(data).hexdigest()[:12]}.webp'
    (OUT/filename).write_bytes(data)
    return filename, len(data)

atlas_file, atlas_bytes = save_versioned(atlas,'sprites',quality=86,method=6,alpha_quality=100)
background = Image.open(OUT/'source'/'landscape.jpg').convert('RGB')
background.thumbnail((960,1440),Image.Resampling.LANCZOS)
background_file, background_bytes = save_versioned(background,'landscape',quality=80,method=6)
manifest = {'version':1,'atlas':atlas_file,'background':background_file,
            'width':atlas.width,'height':atlas.height,'columns':COLS,'rows':ROWS,
            'cellSize':CELL,'frames':frames}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'manifest.js').write_text('window.ASSET_MANIFEST='+json.dumps(manifest,ensure_ascii=False)+';\n',encoding='utf8')
css = f'.sprite{{background-image:url("./{atlas_file}")}}\n'
css += f':root{{--scene-image:url("./assets/{background_file}")}}\n'
(OUT/'atlas.css').write_text(css,encoding='utf8')
original_bytes = sum(p.stat().st_size for p in (OUT/'source').glob('*.jpg'))
report={'originalBytes':original_bytes,'runtimeImageBytes':atlas_bytes+background_bytes,
        'atlasBytes':atlas_bytes,'backgroundBytes':background_bytes,'sprites':len(frames),
        'decodedAtlasBytes':atlas.width*atlas.height*4,
        'reductionPercent':round(100*(1-(atlas_bytes+background_bytes)/original_bytes),2)}
(OUT/'build-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
