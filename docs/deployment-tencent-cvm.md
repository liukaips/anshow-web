# 腾讯云 CVM 生产部署手册

本项目通过一份 `compose.yaml` 在同一台腾讯云 CVM 上运行以下服务：

- `migrate`：启动前执行 SQLite 数据库迁移，成功后退出。
- `backend`：Hono API、Better Auth、管理后台接口和公共内容接口。
- `worker`：询盘邮件、自动备份、整站快照定时发布等后台任务。
- `frontend`：Next.js 公共网站和中文 Admin。
- `caddy`：唯一对外开放的入口，反向代理前后端并自动申请、续期免费 HTTPS 证书。

Caddy 使用 ACME 协议向公开证书机构申请受信任证书，不需要购买腾讯云证书。只要域名解析正确、80/443 端口可访问，证书会自动申请和续期。

## 1. 准备域名和服务器

1. 在腾讯云 DNSPod 为正式域名创建 `A` 记录，指向 CVM 公网 IPv4。
2. 只有服务器确实具备公网 IPv6 时才创建 `AAAA` 记录。
3. CVM 安全组开放公网 TCP 80、443；如需 HTTP/3，可额外开放 UDP 443。
4. 不要向公网开放 3000、4000 端口。
5. SSH 仅允许可信来源地址，并使用密钥登录。
6. 安装 Docker Engine 和 Docker Compose 插件。

首次签发证书前，域名必须已经解析到当前 CVM，公网请求必须能够到达 80/443 端口。

## 2. 配置生产环境

```bash
git clone https://github.com/liukaips/anshow-web.git anshow-web
cd anshow-web
cp .env.example .env
chmod 600 .env
```

生成两个不同的随机密钥：

```bash
openssl rand -base64 48
openssl rand -base64 48
openssl rand -hex 32
```

填写 `.env`：

```dotenv
SITE_HOST=www.example.com
SITE_URL=https://www.example.com
ACME_EMAIL=admin@example.com

BETTER_AUTH_SECRET=<第一个 base64 密钥>
RATE_LIMIT_SECRET=<第二个 base64 密钥>
BACKUP_ENCRYPTION_KEY=<64 位十六进制密钥>
```

以下配置是可选的，但同一组必须完整填写：

- 腾讯云 COS 媒体：`MEDIA_DRIVER=cos`，并填写 `COS_BUCKET`、`COS_REGION`、`COS_PUBLIC_BASE_URL`、`COS_SECRET_ID`、`COS_SECRET_KEY`。
- 腾讯云 COS 备份：在 Admin 选择 COS 存储，并在部署环境填写 `COS_SECRET_ID`、`COS_SECRET_KEY`；存储桶和地域在 Admin 中配置。
- 询盘邮件：完整填写 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`、`SALES_EMAIL`。不用邮件时全部留空。
- 自动翻译：完整填写 `TRANSLATION_API_URL`、`TRANSLATION_API_KEY`、`TRANSLATION_MODEL`。密钥只保存在服务器环境中。

## 3. 首次启动

```bash
docker compose config
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=200 migrate backend worker frontend caddy
```

验收标准：

- `migrate` 退出码为 0。
- `backend` 和 `frontend` 状态为 healthy。
- `worker` 日志包含 `AnShow worker is ready`。
- `caddy` 没有持续的 ACME/DNS 错误。

检查公网服务：

```bash
curl -fsS "https://${SITE_HOST}/api/health/live"
curl -fsS "https://${SITE_HOST}/api/health/ready"
curl -I "https://${SITE_HOST}/en"
```

## 4. 创建首个超级管理员

交互式输入密码，避免密码进入命令历史：

```bash
read -r -s ANSHOW_ADMIN_PASSWORD
printf '%s' "$ANSHOW_ADMIN_PASSWORD" | docker compose run --rm -T backend \
  node backend/dist/scripts/create-admin.js admin@example.com --name "超级管理员"
unset ANSHOW_ADMIN_PASSWORD
```

创建后访问 `https://正式域名/admin/login`。Admin 固定使用中文。

## 5. Admin 中的备份配置

进入“站点设置”：

1. 启用自动备份。
2. 设置备份周期和保留天数。
3. 选择“服务器备份卷”或“腾讯云 COS”。
4. 点击“立即创建备份”。
5. 对新备份执行“验证可恢复性”。

备份包含通过 SQLite Backup API 生成的一致数据库快照和本地媒体文件，能够包含已提交但尚未 checkpoint 的 WAL 数据。备份使用 AES-256-GCM 加密；没有部署时的 `BACKUP_ENCRYPTION_KEY` 无法恢复。

建议生产环境使用 COS 异地备份。服务器本地卷只能防止误删或应用故障，不能防止云盘或整台 CVM 丢失。

## 6. 离线恢复流程

Admin 不会直接覆盖线上数据库。恢复分两步：

1. 在 Admin 对目标备份执行“验证可恢复性”。
2. 点击“准备离线恢复”，系统会把解密并校验通过的恢复包放入受保护的备份卷目录。

记录备份运行编号，然后在 CVM 上执行停机切换。以下示例中的 `RUN_ID` 替换为运行编号：

```bash
export RUN_ID='<备份运行编号>'
docker compose stop frontend backend worker

# 确认恢复包存在，并保存当前线上数据作为回滚点。
docker run --rm \
  -e RUN_ID \
  -v anshow-backups:/restore:ro \
  -v anshow-app-data:/data \
  -v anshow-media:/media \
  alpine sh -eu -c '
    test -f "/restore/.staging/restore-${RUN_ID}/anshow.db"
    cp -a /data/anshow.db "/data/anshow.db.pre-restore"
    tar -czf /data/media.pre-restore.tgz -C /media .
    cp "/restore/.staging/restore-${RUN_ID}/anshow.db" /data/anshow.db
    if [ -d "/restore/.staging/restore-${RUN_ID}/media" ]; then
      rm -rf /media/*
      cp -a "/restore/.staging/restore-${RUN_ID}/media/." /media/
    fi
  '

# 对较旧备份补齐当前版本迁移，再启动全部服务。
docker compose run --rm migrate
docker compose up -d
docker compose ps
curl -fsS "https://${SITE_HOST}/api/health/ready"
unset RUN_ID
```

确认网站、Admin、图片和关键内容正常后，再删除 `anshow.db.pre-restore` 和 `media.pre-restore.tgz`。如需回滚，停止 `frontend/backend/worker`，恢复这两个文件后重新启动。

## 7. 更新发布

```bash
git pull --ff-only
docker compose config
docker compose build --pull
docker compose up -d --remove-orphans
docker compose ps
docker compose logs --tail=200 migrate backend worker frontend caddy
curl -fsS "https://${SITE_HOST}/api/health/ready"
```

不要在日常更新中执行 `docker compose down --volumes`，否则会删除数据库、媒体、备份和证书状态。

## 8. 发布与预览说明

- 内容编辑器只保存草稿和提交审核，不直接发布单条语言内容。
- 发布中心生成不可变整站快照，必须检查中文、英文、俄文预览后才能发布。
- 立即发布和定时发布都会再次校验快照哈希、审核状态、来源版本和过期时间。
- `worker` 是定时发布必需服务；不要只启动 backend/frontend/caddy。

## 9. 常用排查命令

```bash
docker compose ps
docker compose logs --tail=300 backend
docker compose logs --tail=300 worker
docker compose logs --tail=300 frontend
docker compose logs --tail=300 caddy
docker compose restart worker
```

证书申请失败时优先检查 DNSPod 解析、CVM 安全组、80/443 端口占用和 Caddy 日志。备份或定时发布失败时，先查看 Admin 工作台的“系统状态”，再检查 worker 日志。
