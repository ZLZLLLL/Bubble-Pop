# 服务器部署

原生 HTML/CSS/JavaScript + Node.js 24 + SQLite，无 npm 运行依赖。当前提供一个初始账号 `lulu`，使用用户指定的八位初始密码；没有开放注册。游戏内登录取代旧的浏览器 Basic 密码弹窗。

## Docker Compose

克隆仓库后，在项目目录执行：

```sh
cp .env.example .env
docker compose up -d --build
docker compose logs -f --tail=50
```

默认账号会在第一次启动时自动创建。`.env.example` 不包含实际密码，`INITIAL_PASSWORD` 留空会使用预设初始密码；如需更换首次部署的密码，通过服务器环境或本地 `.env` 注入 `INITIAL_PASSWORD`。该变量仅在账号不存在时生效，重启或更新镜像不会重置已有账号密码。旧的 `ACCESS_PASSWORD` 和 `ALLOW_INSECURE` 配置已不使用。

Compose 通过 `${INITIAL_PASSWORD:-}`、`${COOKIE_SECURE:-true}` 引用环境配置。真实 `.env` 不进入 Git 或镜像。SQLite 没有数据库用户名和密码；账号密码以带盐 scrypt 哈希存储，不存明文。

默认监听服务器 `127.0.0.1:5188`，配置 HTTPS 反向代理。Compose 默认 `COOKIE_SECURE=true`；仅在本地 HTTP 测试时设置 `COOKIE_SECURE=false`，否则浏览器可能无法保留登录会话。

Caddy 示例（域名指向服务器，Caddy 运行在宿主机）：

```caddyfile
game.example.com {
    reverse_proxy 127.0.0.1:5188
}
```

宿主机监听地址和端口支持 `${BIND_ADDRESS:-127.0.0.1}`、`${APP_PORT:-5188}`。如果反向代理也在容器内，使用共享 Docker 网络和服务名连接。

## 直接运行 Node.js

安装 Node.js 24 或更新版本，在源代码目录执行：

```sh
npm run build
export DATA_DIR='/var/lib/cloud-teahouse'
export HOST='127.0.0.1'
export PORT='5188'
export COOKIE_SECURE='true'
mkdir -p "$DATA_DIR"
node server.cjs
```

通过本地 HTTP 测试时改用 `COOKIE_SECURE=false`。发布包已包含 public/，不需要执行构建；源代码目录必须先构建。确保运行用户可读写 DATA_DIR。生产环境使用 systemd 等进程管理器保持运行。

## 登录与体力兑换

- 页面内输入账号密码；登录会话保存 7 天，可在棋盘上方点击账号退出。
- 会话使用 HttpOnly、SameSite=Strict Cookie，服务端只保存随机会话令牌的哈希。
- 点击体力旁的 `+` 或底部「兑换体力」输入兑换码。三个内置兑换码分别增加 20、50、60 点体力。
- 每个兑换码对该账号只能领取一次；领取记录与体力增量在同一 SQLite 事务中写入。
- 每日领取和宝石兑换体力已取消。兑换前先完成待保存的棋盘更新，避免旧存档覆盖奖励。
- 登录失败有短时间次数限制。部署没有开放注册或多账号管理。

## 更新、存档与备份

```sh
git pull
docker compose up -d --build
```

SQLite 位于 DATA_DIR/game.sqlite，默认本地 data/game.sqlite。Docker 使用持久化卷 `game-data`；更新镜像或重建容器保留棋盘、账号、会话和兑换记录。旧单人存档自动归入初始账号，不清空旧棋盘。

不要执行 `docker compose down -v`，该命令会删除存档卷。数据库目录不对外提供静态下载。

服务器存档优先。首次无服务器存档时，可导入当前相同浏览器源的本地副本；从 localhost 换到正式域名不会自动迁移原站 localStorage。多页面同时修改时，旧版本写入会被拒绝，提示刷新。

备份时先停止服务，再复制整个数据目录。SQLite 使用 WAL，不能只复制运行中的主文件。Docker 示例：

```sh
docker compose stop game
docker compose cp game:/app/data ./backup-data
docker compose start game
```

清浏览器缓存不会删除服务器存档和兑换记录，重新登录即可继续。删除数据目录或卷则会丢失所有服务器记录。

`npm test` 验证游戏逻辑、登录鉴权、会话撤销、兑换记录持久化、并发重复兑换及存档冲突。`GET /healthz` 是进程探活入口。

游戏合成逻辑仍由前端计算，服务端验证存档结构并持久化；兑换码和奖励金额在服务器校验。这是个人休闲游戏，没有付费、排行榜或完整防作弊系统。
