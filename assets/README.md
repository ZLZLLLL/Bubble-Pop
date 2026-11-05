# 素材存储与加载

最终使用用户原图的本地脚本裁切结果，不使用生成式重绘结果。

- `source/*.jpg`：五张原图，保留供重新处理。游戏不会请求这些文件。
- `cutouts/*.png`：22 个透明底单图，供美术编辑。人物保留原有米色圆形背景。
- `crop-sources.json`：每个素材对应的原图及精确裁切坐标。
- `sprites.<内容哈希>.webp`：1152 × 768 透明图集，6 列 × 4 行，每格 192px，四周有留白，避免串图。
- `landscape.<内容哈希>.webp`：压缩山水背景。
- `manifest.json`：跨框架可用的素材坐标；`manifest.js` 为网页直接加载的同内容索引，兼容双击 HTML。
- `atlas.css`：由构建脚本生成的图集与背景地址。
- `preview.html`：22 个素材预览，可切换棋盘底、深绿底、白底。
- `build-report.json`：实际字节数与压缩比例，不代表实测网络加载耗时。

## 重新构建

从项目根目录运行：

```powershell
python -m pip install -r scripts/requirements-assets.txt
python scripts/extract_assets.py
python scripts/build_assets.py --cutouts
```

裁切配置在 `scripts/extract_assets.py`。外部白底和低饱和投影通过边缘连通区域移除，避免全局删除白色导致米饭、瓷器和白发被挖空。饭菜盘内部有单独保护区域；木框、铜钱和壶把手的孔洞单独处理。此算法针对这五张图调校，换图时需重新检查预览页，不是通用自动抠图模型。

## 运行时

图集约 160 KB，背景约 77 KB；两者合计 236,530 字节。五张原图合计 10,285,345 字节，运行时图片字节数减少 97.7%。图集解码后约占 3.38 MiB RGBA 内存。

CSS background-position 按索引复用同一张图，棋盘每个格子不单独发图片请求。`assets.js` 预加载两张图；缓存由浏览器管理，不把二进制写入 localStorage 或 Base64 JS。服务器对带内容哈希的 WebP 设置一年 immutable 缓存，索引与代码每次重新验证。修改素材后构建会生成新文件名，避免旧缓存。

采用 WebP 仍然属于图片格式；优化来自裁切、尺寸控制、压缩、合图和缓存，并不承诺任意设备上固定加载时长。现有 DOM/CSS 棋盘不需要引入 Canvas/WebGL 或纹理压缩引擎。
