# 服务器部署

本项目是单人网页游戏：原生 HTML/CSS/JS + Node.js 24 + 内置 SQLite，无 npm 运行依赖。所有使用同一部署地址和访问密码的人共享一份存档，不是多用户系统。不同设备输入相同访问密码可继续同一进度。

## 推荐：Docker Compose

将发布包解压到服务器目录，在该目录执行：

也可克隆本仓库后直接使用 Docker Compose；镜像会自动构建前端。

```sh
cp .env.example .env
# 编辑 .env，将 ACCESS_PASSWORD 改成自己的密码
docker compose up -d --build
docker compose logs -f --tail=50
```

仓库不填写任何实际密码：`.env.example` 的密码值留空，Compose 使用 `${ACCESS_PASSWORD:?...}` 引用部署环境变量（`:?` 表示未设置或为空时给出提示）。可以由服务器管理面板、CI 或 shell 注入 `ACCESS_PASSWORD`，此时无需创建 `.env`。真实 `.env` 已加入 Git 和 Docker 的忽略列表。

SQLite 是本地文件数据库，没有数据库用户名或密码；`ACCESS_PASSWORD` 仅用于网页访问验证。监听地址和宿主机端口也支持 `${BIND_ADDRESS:-127.0.0.1}`、`${APP_PORT:-5188}`，`:-` 后为默认值。

数据库在持久化卷 `game-data` 中，容器重建保留数据。不要执行 `docker compose down -v`，该命令会删除存档卷。发布包已包含 public/，无需运行 Python 或安装美术处理工具。

默认仅监听服务器的 127.0.0.1:5188。用 Nginx/Caddy 反向代理到该地址并启用 HTTPS。浏览器弹出访问验证时，用户名为 `player`，密码为 `.env` 中设置的值。没有配置密码时容器会拒绝启动。

例如，Caddyfile（将域名替换为你的域名并将 DNS 指向服务器）：

```caddyfile
game.example.com {
    reverse_proxy 127.0.0.1:5188
}
```

这份配置适用于 Caddy 运行在宿主机。若 Caddy 也在容器内，需要配置共享 Docker 网络并改为服务名地址。

## 不用 Docker

服务器安装 Node.js 24 或更新版本。在发布包目录执行：

```sh
# 由部署环境事先注入 ACCESS_PASSWORD；以下命令只引用变量，不写密码
export ACCESS_PASSWORD="${ACCESS_PASSWORD:?请先在部署环境设置 ACCESS_PASSWORD}"
export DATA_DIR='/var/lib/cloud-teahouse'
export HOST='127.0.0.1'
export PORT='5188'
mkdir -p "$DATA_DIR"
node server.cjs
```

请确保运行服务的用户对 DATA_DIR 有读写权限。生产环境用 systemd 等进程管理器保持运行，并配置反向代理 HTTPS。源代码目录首次运行须先 `npm run build`；发布包已经构建完成。

环境变量：ACCESS_PASSWORD（访问密码）、DATA_DIR（持久化目录）、HOST（默认 127.0.0.1）、PORT（默认 5188）。仅本地测试可设置 ALLOW_INSECURE=1 跳过访问密码。

## 存档、迁移与备份

- SQLite 文件：DATA_DIR/game.sqlite，默认项目 data/game.sqlite。数据目录不作为静态文件对外提供。
- 首次打开时，优先读取 SQLite。数据库没有存档时，可自动导入**当前相同浏览器源**已有的 localStorage 存档；从 localhost 换到正式域名不会自动携带旧站存档。
- 前端仍保留本地副本作辅助，但服务器为准。保存失败会显示重试状态，离开页面前应看到「已保存到 SQLite」。不要在网络失败时清缓存。
- 多标签页或多设备同时修改时，旧版本写入会被拒绝，需要刷新，避免覆盖其他页面的进度。
- 备份时先停服务，再复制**整个数据目录**。SQLite 使用 WAL，不应只复制正在运行中的 .sqlite 主文件。
- Docker 示例：`docker compose stop game`，然后 `docker compose cp game:/app/data ./backup-data`，完成后 `docker compose start game`。请把备份放到服务器以外的位置。
- 清浏览器缓存不删除服务器存档。删除数据库目录或持久化卷才会丢失服务器进度。

## 验证

`GET /healthz` 用于进程探活；存档接口需要访问密码。打开游戏、合成一次，等状态显示已保存，重启服务并刷新，验证棋盘恢复。

这是轻量休闲游戏，物品合成与资源变更由前端计算，后端验证存档结构并持久化；没有付费、排行榜或防作弊系统。
