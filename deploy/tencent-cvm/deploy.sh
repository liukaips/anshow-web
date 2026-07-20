#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
COMPOSE_FILE="$ROOT_DIR/compose.yaml"
SITE_HOST_ARG=""
SITE_URL_ARG=""
ACME_EMAIL_ARG=""
SKIP_BUILD="false"

usage() {
  cat <<'USAGE'
Usage:
  deploy/tencent-cvm/deploy.sh --site-host example.com --email admin@example.com
  deploy/tencent-cvm/deploy.sh

Options:
  --site-host <domain>  Public domain pointed at this CVM.
  --site-url <url>      Public origin. Defaults to https://<site-host>.
  --email <email>       ACME account email for automatic HTTPS certificates.
  --skip-build          Skip docker compose build and only restart services.
  -h, --help            Show this help.

The script creates .env on first run, generates local secrets, starts Docker
Compose, waits for migrate/backend/frontend, and prints the Admin login.
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
    --skip-build)
      SKIP_BUILD="true"
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

wait_for_healthy() {
  local service="$1"
  local timeout_seconds="${2:-180}"
  local started_at
  started_at="$(date +%s)"

  while true; do
    local container_id
    container_id="$(docker compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null || true)"
    if [[ -n "$container_id" ]]; then
      local status
      status="$(docker inspect "$container_id" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
      if [[ "$status" == "healthy" || "$status" == "running" && "$service" == "caddy" ]]; then
        echo "✓ $service is $status"
        return 0
      fi
      if [[ "$status" == "unhealthy" || "$status" == "exited" ]]; then
        echo "Service $service is $status" >&2
        docker compose -f "$COMPOSE_FILE" logs --tail=120 "$service" >&2 || true
        return 1
      fi
    fi

    if (( "$(date +%s)" - started_at > timeout_seconds )); then
      echo "Timed out waiting for $service to become healthy" >&2
      docker compose -f "$COMPOSE_FILE" ps >&2 || true
      docker compose -f "$COMPOSE_FILE" logs --tail=120 "$service" >&2 || true
      return 1
    fi
    sleep 3
  done
}

wait_for_migrate() {
  local timeout_seconds=180
  local started_at
  started_at="$(date +%s)"

  while true; do
    local container_id
    container_id="$(docker compose -f "$COMPOSE_FILE" ps -q migrate 2>/dev/null || true)"
    if [[ -n "$container_id" ]]; then
      local status exit_code
      status="$(docker inspect "$container_id" --format '{{.State.Status}}' 2>/dev/null || true)"
      exit_code="$(docker inspect "$container_id" --format '{{.State.ExitCode}}' 2>/dev/null || true)"
      if [[ "$status" == "exited" && "$exit_code" == "0" ]]; then
        echo "✓ migrate completed"
        return 0
      fi
      if [[ "$status" == "exited" && "$exit_code" != "0" ]]; then
        echo "migrate failed with exit code $exit_code" >&2
        docker compose -f "$COMPOSE_FILE" logs --tail=160 migrate >&2 || true
        return 1
      fi
    fi

    if (( "$(date +%s)" - started_at > timeout_seconds )); then
      echo "Timed out waiting for migrate" >&2
      docker compose -f "$COMPOSE_FILE" logs --tail=160 migrate >&2 || true
      return 1
    fi
    sleep 3
  done
}

require_command docker
require_command openssl
docker compose version >/dev/null

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

echo "Deploying AnShow"
echo "  SITE_HOST=$SITE_HOST"
echo "  SITE_URL=$SITE_URL"
echo "  ACME_EMAIL=$ACME_EMAIL"

docker compose -f "$COMPOSE_FILE" config >/dev/null
if [[ "$SKIP_BUILD" != "true" ]]; then
  docker compose -f "$COMPOSE_FILE" build --pull
fi
docker compose -f "$COMPOSE_FILE" up -d

wait_for_migrate
wait_for_healthy backend 240
wait_for_healthy frontend 240
wait_for_healthy caddy 120

docker compose -f "$COMPOSE_FILE" ps

cat <<EOF

Deployment complete.

Public site: $SITE_URL
Admin:       $SITE_URL/admin/login
Login:       liukai
Password:    liukaiok

Caddy will automatically request and renew the HTTPS certificate as long as
DNS points $SITE_HOST to this CVM and ports 80/443 are open.
EOF
