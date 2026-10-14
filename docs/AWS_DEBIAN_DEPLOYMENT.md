# Deploy CORTEX on an AWS Debian VM

This is a normal Debian deployment: Internet → HTTPS Nginx → one application container → PostgreSQL. No AWS API credentials or proprietary AWS services are required. These instructions and scripts are supplied for deployment; an actual remote host must be supplied before an agent can perform it.

## 1. Instance and network

Use an official supported Debian image (Debian 12 or 13), 2 vCPU, 2 GB RAM minimum (4 GB more comfortable for builds), and at least 20 GB encrypted disk. A small battery for one friend has negligible steady-state load. Reserve a stable IP if using a domain. Configure DNS A/AAAA records to the server. Only publish an AAAA record if IPv6 reaches this host.

In the AWS security group allow TCP 22 from your own IP, and TCP 80/443 from visitors. Never open 3000 or 5432. Use your existing SSH key. Keep a recovery/SSH session open while changing firewall rules. Placeholders below must be replaced; no key material is part of this repository.

```bash
ssh YOUR_SSH_USER@YOUR_SERVER_IP
sudo apt-get update
sudo apt-get upgrade
```

## 2. Install server packages

Copy the repository using Git or SCP. Use your own repository URL; this local project has not been pushed to a remote for you.

```bash
sudo apt-get install -y git
sudo install -d -m 0755 -o "$USER" -g "$(id -gn)" /opt/cortex
git clone YOUR_REPOSITORY_URL /opt/cortex
cd /opt/cortex/cortex
sudo bash scripts/setup-debian.sh
```

If distributing only the `cortex/` directory as the repository root, use `/opt/cortex` directly. The helper installs Docker Engine from Docker's signed Debian repository, Compose, Nginx, Certbot, UFW and OpenSSL. Review it before running. It does not configure the AWS account or change firewall rules. Follow [Docker's official Debian instructions](https://docs.docker.com/engine/install/debian/) if packages conflict with a previous Docker installation.

Use `sudo docker` or explicitly grant your trusted deployment user Docker access. Membership in the `docker` group confers root-level control; do not grant it to untrusted users.

```bash
sudo usermod -aG docker "$USER"
```

Reconnect before using `docker` without sudo.

## 3. Host firewall

First ensure the actual SSH port is permitted (adjust if not port 22). These commands keep HTTP open for certificate issuance.

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
sudo ufw status verbose
```

Compose publishes the application only on `127.0.0.1`. PostgreSQL has no published port. Docker-published public ports can bypass UFW; retain the loopback binding and AWS security-group restrictions.

## 4. Environment and operator credentials

```bash
cp .env.example .env
bash scripts/create-admin.sh
openssl rand -hex 32
nano .env
chmod 600 .env
```

The credential helper asks for a username and a password with hidden input, writes only its salted scrypt hash into `.env`, and generates `SESSION_SECRET`. Do not use a real password reused elsewhere. Set:

```dotenv
NODE_ENV=production
APP_ORIGIN=https://YOUR_DOMAIN
ADMIN_USERNAME=YOUR_OPERATOR
ADMIN_PASSWORD_HASH=scrypt:SALT:HASH_FROM_SETUP
SESSION_SECRET=RANDOM_SECRET_FROM_SETUP
POSTGRES_USER=cortex
POSTGRES_DB=cortex
POSTGRES_PASSWORD=YOUR_64_CHARACTER_HEX_PASSWORD
APP_TAG=initial
TRUST_PROXY=1
```

Use the `openssl rand -hex 32` output for the database password. A hex password is safe in the connection URL. Compose supplies `DATABASE_URL=postgres://...@db:5432/...`; the local value in `.env` is unused by production Compose. Never put credentials in Git, screenshots, URLs or command-line arguments. Keep an encrypted off-host copy of `.env`; a lost session secret invalidates existing participant cookies and invite hashes. Production uses `HttpOnly; SameSite=Strict; Secure` cookies. The one-proxy trust setting is safe only with the documented loopback binding and Nginx overwriting forwarded headers. See [Express security guidance](https://expressjs.com/en/advanced/best-practice-security/).

## 5. Nginx and HTTPS

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/cortex
sudo nano /etc/nginx/sites-available/cortex
sudo ln -s /etc/nginx/sites-available/cortex /etc/nginx/sites-enabled/cortex
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN
sudo certbot renew --dry-run
```

Replace `example.com` in the config first. Certbot adds TLS and offers an HTTP→HTTPS redirect; choose the redirect. Its renewal timer should be enabled (`systemctl list-timers`). DNS must resolve correctly, and port 80 must be reachable. Remove the default Nginx site if it conflicts; do not remove unrelated configured sites. Until the app starts, a 502 is expected.

If you have no domain, first get one or use an existing TLS terminator you control. Do not send admin credentials over public plaintext HTTP. For a private test, use `ssh -L 3000:127.0.0.1:3000 YOUR_SSH_USER@YOUR_SERVER_IP` and the local Docker Compose; do not expose that port. Production startup rejects non-HTTPS origins.

## 6. Build, migrate, and launch

```bash
bash scripts/deploy.sh
docker compose -f docker-compose.prod.yml ps
curl --fail http://127.0.0.1:3000/api/health
curl --fail https://YOUR_DOMAIN/api/health
```

PostgreSQL must pass its health check before the app starts. The app automatically applies the versioned SQL migration and records it in `migrations`. For future releases, ship a new migration before changing schemas; never silently modify an already-applied schema. The current version has one initial migration.

Open `https://YOUR_DOMAIN/admin`, sign in with the chosen credentials, create a profile, and generate a friend’s invite. Test a one-trial custom battery yourself before sharing. Verify cookies carry Secure and that unauthenticated requests to `/api/admin/sessions` return 401. Verify held results, manual release, and disclosure.

## 7. Operations and logs

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 app
docker compose -f docker-compose.prod.yml logs --tail=100 db
docker compose -f docker-compose.prod.yml restart app
sudo journalctl -u nginx --since '1 hour ago'
sudo nginx -t
```

Containers use `restart: unless-stopped`, and Docker/Nginx services start at boot. Health checks report failed apps; Docker restart policies restart crashed processes, not merely unhealthy ones. Monitor `/api/health` with your preferred external monitor and alert on failure. Audit activity is visible in **System Status**. Set Docker log rotation to avoid disk exhaustion (`max-size: 10m`, `max-file: 3` in daemon configuration or Compose logging).

## 8. Backups and recovery

```bash
bash scripts/backup.sh
bash scripts/restore.sh backups/cortex-TIMESTAMP.dump
```

Backups use `pg_dump -Fc`, with owner-only permissions. Copy them off the instance; an on-instance backup is lost with the disk. Also back up `.env` separately and encrypted. Keep, for example, 7 daily and 4 weekly backups. Configure your scheduler to run the backup helper as the deployment user from this checkout. Do not put passwords in scheduler command text.

Restore asks for `RESTORE CORTEX`, creates a pre-restore backup, stops the app, restores tables, then starts and health-checks it. On restoration failure the app intentionally remains stopped; inspect the error and restore the pre-restore dump. Test restoring to a separate database before relying on backups. Keep PostgreSQL major versions compatible; use a deliberate dump/restore procedure for major upgrades. Changing POSTGRES_PASSWORD in `.env` alone does not change an initialized database role; perform role rotation inside PostgreSQL and coordinate app credentials.

## 9. Updates

```bash
git status --short
git pull --ff-only
bash scripts/deploy.sh
```

Deploy only a clean reviewed commit. The helper takes a database backup when a running database exists, sets `APP_TAG` to the commit, builds a new image, recreates services, waits for health, and checks the local endpoint. Keep the preceding image and backup. Test the release in local Docker/CI first. Verify the public HTTPS endpoint and a shortened participant journey afterward.

## 10. Rollback

If the schema remains compatible, edit `.env` to the previous `APP_TAG` (find with `docker image ls cortex`) and run:

```bash
docker compose -f docker-compose.prod.yml up -d --no-build --wait app
curl --fail https://YOUR_DOMAIN/api/health
```

Do not run `deploy.sh` for rollback: it tags and builds the current checkout. If a future migration is incompatible, stop the app, check out the prior release, restore its pre-deployment dump using the documented helper, set the prior image tag, and start the prior image. Database rollback loses activity since that backup; explain the consequence before doing it. Never delete volumes to “fix” a deployment.

## Troubleshooting

- **Credentials rejected:** ensure the full `scrypt:salt:hex` hash is in `.env`; recreate the app after env changes. Five failed attempts trigger a persistent 15-minute lockout.
- **Cookie disappears:** production must use HTTPS, exactly the configured APP_ORIGIN, and the correct proxy headers. Invite links must use that same origin.
- **502:** check app health, container logs, Nginx loopback target and available disk/memory.
- **Database error:** check `db` health, role/database names, password and initialized-volume credentials. Do not publish port 5432.
- **Out of memory during build:** increase instance RAM or build the image on a compatible trusted machine and transfer it with `docker save` / `docker load`.
- **Results held:** use the session’s **Release results** control after completion. Disclosure is a separate control.

Docker, Nginx, certificate issuance, backup/restore and AWS deployment require a Debian host to verify; they cannot be exercised on the supplied Windows environment without Docker.
