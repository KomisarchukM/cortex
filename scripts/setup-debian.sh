#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Run with sudo on the intended Debian server.' >&2; exit 1; fi
source /etc/os-release
if [[ ${ID} != debian ]]; then echo 'This helper supports Debian only.' >&2; exit 1; fi
echo 'Installing Docker from its official repository, Nginx, Certbot and firewall tools.'
apt-get update
apt-get install -y ca-certificates curl gnupg git nginx certbot python3-certbot-nginx ufw openssl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian %s stable\n' "$(dpkg --print-architecture)" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker nginx
echo 'Installation complete. Firewall remains unchanged. Read docs/AWS_DEBIAN_DEPLOYMENT.md before enabling it.'
