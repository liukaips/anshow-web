#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
SITE_HOST_ARG=""
SITE_URL_ARG=""
ACME_EMAIL_ARG=""
SKIP_INSTALL="false"
SKIP_BUILD="false"
SKIP_CADDY="false"
DATA_ROOT="/srv/anshow"

usage() {
  cat <<'USAGE'
Usage:
  deploy/pm2/deploy.sh --site-host example.com --email admin@example.com
  deploy/pm2/deploy.sh

Options:
  --site-host <domain>  Public domain pointed at this CVM.
  --site-url <url>      Public origin. Defaults to https://<site-host>.
  --email <email>       ACME account email for automatic HTTPS certificates.
  --data-root <path>    Runtime data root. Defaults to /srv/anshow.
  --skip-install        Skip apt/node/pm2/caddy dependency checks.
  --skip-build          Skip pnpm install/build and only migrate/reload PM2.
  --skip-caddy          Do not install/update the host Caddy reverse proxy.
  -h, --help            Show this help.

This script runs AnShow without Docker:
  - backend API: 127.0.0.1:4000 via PM2
  - background worker: PM2
  - frontend: 127.0.0.1:3000 via PM2 / Next standalone
  - HTTPS: Caddy on ports 80/443 with automatic free certificate renewal
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --site-host)
      SITE_HOST_ARG="${2:-}"
      shift 2
      ;;
    --site-url)
      SITE_URL_ARG="${2:-}"
      shift 2
      ;;
    --email)
      ACME_EMAIL_ARG="${2:-}"
      shift 2
      ;;
    --data-root)
      DATA_ROOT="${2:-}"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL="true"
      shift
      ;;
    --skip-build)
      SKIP_BUILD="true"
      shift
      ;;
    --skip-caddy)
      SKIP_CADDY="true"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

as_root() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
    return
  fi
  require_command sudo
  sudo "$@"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { done = 0 }
    $0 ~ "^" key "=" { print key "=" value; done = 1; next }
    { print }
    END { if (done == 0) print key "=" value }
  ' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
}

read_env_value() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true
}

random_base64() {
  openssl rand -base64 48 | tr -d '\n'
}

random_hex() {
  openssl rand -hex 32 | tr -d '\n'
}

major_version() {
  "$1" -v 2>/dev/null | sed -E 's/^v?([0-9]+).*/\1/' || true
}

install_node_24() {
  require_command curl
  as_root apt-get update
  as_root apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_24.x | as_root bash -
  as_root apt-get install -y nodejs
}

install_caddy() {
  require_command curl
  as_root apt-get update
  as_root apt-get install -y debian-keyring debian-archive-keyring apt-transport-https ca-certificates curl gnupg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | as_root gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | as_root tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  as_root apt-get update
  as_root apt-get install -y caddy
}

prepare_host_dependencies() {
  require_command openssl
  require_command sed
  require_command awk
  as_root apt-get update
  as_root apt-get install -y build-essential python3 ca-certificates curl

  local node_major
  node_major="$(major_version node)"
  if [[ -z "$node_major" || "$node_major" -lt 24 ]]; then
    install_node_24
  fi

  corepack enable || as_root corepack enable
  corepack prepare pnpm@10.11.0 --activate

  if ! command -v pm2 >/dev/null 2>&1; then
    as_root npm install -g pm2
  fi

  if [[ "$SKIP_CADDY" != "true" ]] && ! command -v caddy >/dev/null 2>&1; then
    install_caddy
  fi
}

write_caddy_config() {
  local site_host="$1"
  local acme_email="$2"
  local data_root="$3"
  local template="$ROOT_DIR/deploy/pm2/Caddyfile.template"
  local rendered
  rendered="$(mktemp)"
  sed \
    -e "s|{{SITE_HOST}}|$site_host|g" \
    -e "s|{{ACME_EMAIL}}|$acme_email|g" \
    -e "s|{{DATA_ROOT}}|$data_root|g" \
    "$template" > "$rendered"

  as_root install -m 0644 "$rendered" /etc/caddy/Caddyfile
  rm -f "$rendered"
  as_root caddy validate --config /etc/caddy/Caddyfile
  as_root systemctl enable --now caddy
  as_root systemctl reload caddy || as_root systemctl restart caddy
}

copy_next_standalone_assets() {
  rm -rf "$ROOT_DIR/frontend/.next/standalone/frontend/public"
  rm -rf "$ROOT_DIR/frontend/.next/standalone/frontend/.next/static"
  mkdir -p "$ROOT_DIR/frontend/.next/standalone/frontend/.next"
  cp -R "$ROOT_DIR/frontend/public" "$ROOT_DIR/frontend/.next/standalone/frontend/public"
  cp -R "$ROOT_DIR/frontend/.next/static" "$ROOT_DIR/frontend/.next/standalone/frontend/.next/static"
}

sync_builtin_media() {
  rm -rf "$DATA_ROOT/builtin-media"
  mkdir -p "$DATA_ROOT/builtin-media/media"
  cp -R "$ROOT_DIR/frontend/public/media/." "$DATA_ROOT/builtin-media/media/"
}

wait_for_http() {
  local url="$1"
  local timeout_seconds="${2:-120}"
  local started_at
  started_at="$(date +%s)"
  while true; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "✓ $url is reachable"
      return 0
    fi
    if (( "$(date +%s)" - started_at > timeout_seconds )); then
      echo "Timed out waiting for $url" >&2
      pm2 status >&2 || true
      pm2 logs --lines 120 --nostream >&2 || true
      return 1
    fi
    sleep 3
  done
}

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -z "$SITE_HOST_ARG" || -z "$ACME_EMAIL_ARG" ]]; then
    echo ".env does not exist. Provide --site-host and --email on first run." >&2
    usage >&2
    exit 2
  fi
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

if [[ -n "$SITE_HOST_ARG" ]]; then
  set_env_value SITE_HOST "$SITE_HOST_ARG"
fi
if [[ -n "$SITE_URL_ARG" ]]; then
  set_env_value SITE_URL "$SITE_URL_ARG"
elif [[ -n "$SITE_HOST_ARG" ]]; then
  set_env_value SITE_URL "https://$SITE_HOST_ARG"
fi
if [[ -n "$ACME_EMAIL_ARG" ]]; then
  set_env_value ACME_EMAIL "$ACME_EMAIL_ARG"
fi

set_env_value DATABASE_PATH "$DATA_ROOT/data/anshow.db"
set_env_value BACKUP_DIR "$DATA_ROOT/backups"
set_env_value LOCAL_MEDIA_ROOT "$DATA_ROOT/media"
if [[ -z "$(read_env_value MEDIA_DRIVER)" ]]; then
  set_env_value MEDIA_DRIVER "local"
fi
if [[ -z "$(read_env_value BETTER_AUTH_SECRET)" ]]; then
  set_env_value BETTER_AUTH_SECRET "$(random_base64)"
fi
if [[ -z "$(read_env_value RATE_LIMIT_SECRET)" ]]; then
  set_env_value RATE_LIMIT_SECRET "$(random_base64)"
fi
if [[ -z "$(read_env_value BACKUP_ENCRYPTION_KEY)" ]]; then
  set_env_value BACKUP_ENCRYPTION_KEY "$(random_hex)"
fi

SITE_HOST="$(read_env_value SITE_HOST)"
SITE_URL="$(read_env_value SITE_URL)"
ACME_EMAIL="$(read_env_value ACME_EMAIL)"

if [[ -z "$SITE_HOST" || "$SITE_HOST" == "example.com" ]]; then
  echo "Set a real SITE_HOST in .env or pass --site-host." >&2
  exit 2
fi
if [[ -z "$SITE_URL" || "$SITE_URL" == "https://example.com" ]]; then
  echo "Set a real SITE_URL in .env or pass --site-host/--site-url." >&2
  exit 2
fi
if [[ -z "$ACME_EMAIL" || "$ACME_EMAIL" == "admin@example.com" ]]; then
  echo "Set a real ACME_EMAIL in .env or pass --email." >&2
  exit 2
fi

echo "Deploying AnShow with PM2"
echo "  SITE_HOST=$SITE_HOST"
echo "  SITE_URL=$SITE_URL"
echo "  DATA_ROOT=$DATA_ROOT"

if [[ "$SKIP_INSTALL" != "true" ]]; then
  prepare_host_dependencies
else
  require_command openssl
  require_command pnpm
  require_command pm2
fi

as_root mkdir -p "$DATA_ROOT/data" "$DATA_ROOT/media" "$DATA_ROOT/backups"
as_root chown -R "$(id -u):$(id -g)" "$DATA_ROOT"

if [[ "$SKIP_BUILD" != "true" ]]; then
  pnpm install --frozen-lockfile --prefer-offline
  pnpm --filter @anshow/backend build
  pnpm --filter @anshow/frontend build
  copy_next_standalone_assets
fi

sync_builtin_media
pnpm --filter @anshow/backend db:migrate

pm2 startOrReload "$ROOT_DIR/deploy/pm2/ecosystem.config.cjs" --update-env
pm2 save

wait_for_http http://127.0.0.1:4000/api/health/ready 120
wait_for_http http://127.0.0.1:3000/en 120

if [[ "$SKIP_CADDY" != "true" ]]; then
  write_caddy_config "$SITE_HOST" "$ACME_EMAIL" "$DATA_ROOT"
fi

pm2 status

cat <<EOF

PM2 deployment complete.

Public site: $SITE_URL
Admin:       $SITE_URL/admin/login
Login:       liukai
Password:    liukaiok

Runtime data:
  SQLite: $DATA_ROOT/data/anshow.db
  Media:  $DATA_ROOT/media
  Backup: $DATA_ROOT/backups

Caddy will automatically request and renew the HTTPS certificate as long as
DNS points $SITE_HOST to this CVM and ports 80/443 are open.
EOF
