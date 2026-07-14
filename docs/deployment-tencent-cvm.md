# Tencent Cloud CVM deployment

This deployment runs the Next.js frontend, Hono API, SQLite migration, and Caddy on one CVM. Caddy obtains and renews a publicly trusted ACME certificate automatically; no paid Tencent certificate is needed.

## Prepare DNS and the CVM

1. In DNSPod, create an `A` record for `SITE_HOST` pointing to the CVM public IPv4 address. Create an `AAAA` record only when the CVM has working public IPv6 routing. If the domain was registered elsewhere, delegate its authoritative nameservers to the DNSPod nameservers shown for the zone.
2. In the CVM security group and host firewall, allow inbound TCP 80 and 443 from the internet. UDP 443 is optional for HTTP/3. Restrict SSH to trusted source addresses; application ports 3000 and 4000 are not published.
3. Install Docker Engine with the Compose plugin. Keep enough disk space for images, SQLite, uploaded media, backups, and Caddy certificate state.

DNS must resolve to the CVM and TCP 80/443 must reach Caddy before public certificate issuance can succeed.

## First deployment

```sh
git clone <repository-url> anshow-web
cd anshow-web
cp .env.example .env
chmod 600 .env
# Edit .env, set the real hostname/email, and generate two different secrets:
openssl rand -base64 48
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 migrate backend frontend caddy
```

The migration container must exit with status 0. Compose dependency conditions are startup gates, not continuous supervision; container health and restart policies handle later failures.

## Create the first administrator

Passing the password over standard input avoids storing it in the Compose file:

```bash
read -r -s ANSHOW_ADMIN_PASSWORD
printf '%s' "$ANSHOW_ADMIN_PASSWORD" | docker compose run --rm -T backend \
  node backend/dist/scripts/create-admin.js admin@example.com --name Administrator
unset ANSHOW_ADMIN_PASSWORD
```

For non-interactive automation, export the variable and explicitly pass it through; protect the calling environment and CI logs:

```sh
export ANSHOW_ADMIN_PASSWORD='<read from a secret manager>'
docker compose run --rm -T -e ANSHOW_ADMIN_PASSWORD backend \
  node backend/dist/scripts/create-admin.js admin@example.com --name Administrator
unset ANSHOW_ADMIN_PASSWORD
```

## Update and verify

```sh
git pull --ff-only
docker compose build --pull
docker compose up -d --remove-orphans
docker compose ps
curl --fail https://example.com/api/health/live
curl --fail https://example.com/api/health/ready
```

Replace `example.com` with `SITE_HOST`. Only Caddy publishes host ports.

## Persistence and backups

The volumes have stable explicit names: `anshow-app-data`, `anshow-media`, `anshow-caddy-data`, and `anshow-caddy-config`. Caddy `/data` contains its ACME account and certificates and must persist. Named volumes survive container replacement, but not CVM or disk loss.

Never use `docker compose down --volumes` during routine updates. Back up SQLite (including WAL state), media, and Caddy data to encrypted off-CVM storage. For a consistent filesystem backup, briefly stop writers and archive the volumes:

```sh
mkdir -p backups
docker compose stop backend caddy
docker run --rm -v anshow-app-data:/source:ro -v "$PWD/backups":/backup alpine \
  tar -czf /backup/app-data.tgz -C /source .
docker run --rm -v anshow-media:/source:ro -v "$PWD/backups":/backup alpine \
  tar -czf /backup/media.tgz -C /source .
docker run --rm -v anshow-caddy-data:/source:ro -v "$PWD/backups":/backup alpine \
  tar -czf /backup/caddy-data.tgz -C /source .
docker compose up -d
```

Copy the archives away from the CVM and test restoration regularly. Back up `anshow-caddy-config` as well if Caddy runtime configuration state becomes material.
