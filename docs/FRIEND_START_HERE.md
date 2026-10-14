# CORTEX: start here

You have a complete application, not a design mockup. You do **not** need to edit its source code. First run it on your computer. Hosting it for someone on the Internet is a separate optional step below.

## A. Run it locally — smallest setup

1. Use **Node.js 22.12 or newer**. Node 24 LTS from [nodejs.org](https://nodejs.org/) is recommended for a fresh installation. Restart your terminal after installation.
2. Extract `cortex-source.zip`. Open a terminal **inside the extracted `cortex` folder** (the folder containing `package.json`).
3. Run:

```bash
npm install
npm run admin:setup
npm run dev
```

`admin:setup` creates `.env` automatically from `.env.example`. It asks for an operator username and a new password with at least 12 characters. Password input is hidden. Remember the password; only its hash is stored. Do not reuse your personal password. It also creates the required session secret for you.

Open **http://localhost:3000**. Operator login: **http://localhost:3000/admin**. Sign in with the username/password you just chose. SQLite creates its database automatically in `data/cortex.db`.

**Minimum changes for local use: none.** Keep the defaults. Leave the terminal running. Ctrl+C stops the app; restarting preserves progress and profiles. Run `npm run demo` if you want a sample held session and preset in the admin console.

If you prefer an automatically generated local password:

```bash
npm run admin:generate
```

The generated password is in `data/operator-credentials.txt`. Store it, then delete that file. `.env` and `data/` are ignored by Git and excluded from the source ZIP.

To take the test in Ukrainian, choose **Українська** in the **Language** selector before preparing the assessment. The questions, choices, instructions, memory words, typing passages and results switch to Ukrainian, and resume keeps that language. The operator console remains in English.

On Node 22.12, an “ExperimentalWarning: SQLite” message is normal. The npm scripts supply the required flag; no manual Node upgrade is required. If a second app is already running on port 3000, stop it first. The development server watches `.env`, so newly generated credentials become active automatically; a production process must be restarted.

## B. Prepare the prank in five minutes

1. Log in at `/admin` and open **Result Profiles → Create profile**.
2. Give the profile a name such as `Friend — disaster`.
3. In **Load preset**, choose **Absolute Disaster**. The starting index is **70 / 1000**, equivalent to 7 / 100. Set index to `7` if you want 7 / 1000. Every dimension and metric is editable. The recommendation can be “Hardware appears functional. User error suspected.”
4. Leave **Result release = Hold for operator review** and **Prank reveal = Operator controlled**. Save.
5. Open **Invite Links**, select your profile, and click **Generate unique invite**. Copy the link immediately; the server stores only its hash. Default: one use, expires after seven days.
6. Send the link yourself. Invite links created locally point to localhost and work only on that computer. Host the application using section D to create Internet-accessible links.
7. For a dry run, use a new invite in an incognito window, choose **Custom**, select one dimension, and set one or two trials. For the friend, use **Extended Research Battery**. Timing varies with participant speed; this is not a fixed 105-minute timer.
8. In **Sessions** or **Active Sessions**, open the participant to see progress, recent responses, genuine metrics and the session seed. There is no camera, microphone or screen monitoring.
9. After completion, **Configure displayed result** if you want to change the ending. Save **before** clicking **Release results**. The friend’s waiting page updates automatically.
10. Click **Trigger prank reveal** when ready. The final disclosure page explains the prank and compares genuine and displayed scores. You can always inspect genuine metrics in the admin session detail.

Every released report discloses the prank within 24 hours even if you forget to reveal manually. Editing a profile changes future sessions, not sessions that already started; edit the particular session to change its ending.

## C. Local Docker — optional

Install Docker Engine/Desktop using its official instructions. Once it is running:

```bash
npm install
npm run admin:setup
docker compose up --build -d
```

Stop the normal `npm run dev` server first because both use port 3000. Open the same local URLs. This runs the production bundle with SQLite in a persistent Docker volume. No source edits or database configuration are needed.

```bash
docker compose logs --tail=100 app
docker compose down
```

`down` keeps the database volume. Do **not** add `-v` unless you intend to erase the database.

## D. Host it on AWS Debian — minimum changes

Use a clean Debian 12/13 VM with 2 vCPU and 2–4 GB RAM. Point your own domain at its IP. Allow SSH from your IP and ports 80/443 for visitors in the AWS security group. Keep ports 3000 and 5432 closed.

Upload the ZIP to the server using your existing SSH access:

```bash
scp cortex-source.zip YOUR_SSH_USER@YOUR_SERVER_IP:~
ssh YOUR_SSH_USER@YOUR_SERVER_IP
sudo apt-get update
sudo apt-get install -y unzip
sudo install -d -o "$USER" -g "$(id -gn)" /opt/cortex
unzip ~/cortex-source.zip -d /opt/cortex
cd /opt/cortex/cortex
sudo bash scripts/setup-debian.sh
```

Use `sudo docker` or grant Docker access to your trusted deployment account as explained in the full guide. Reconnect after changing group membership. Then:

```bash
bash scripts/create-admin.sh
openssl rand -hex 32
nano .env
```

Only change these **three settings** in `.env`; credential setup already fills the admin username, password hash and session secret:

| Setting             | What to use                                       |
| ------------------- | ------------------------------------------------- |
| `APP_ORIGIN`        | `https://YOUR_DOMAIN` — no trailing slash         |
| `NODE_ENV`          | `production`                                      |
| `POSTGRES_PASSWORD` | The random hex output from `openssl rand -hex 32` |

Leave other defaults. The production Compose file selects PostgreSQL and correct proxy/cookie settings automatically. Do not put the plaintext admin password into `.env`.

```bash
chmod 600 .env
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/cortex
sudo nano /etc/nginx/sites-available/cortex
```

In that Nginx file change **only `example.com` to your domain**. Then:

```bash
sudo ln -s /etc/nginx/sites-available/cortex /etc/nginx/sites-enabled/cortex
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN
bash scripts/deploy.sh
```

Choose Certbot’s HTTPS redirect. Open **https://YOUR_DOMAIN/admin**, create a fresh invite, and test a short battery before sending the real link. The new links will use your domain automatically. No application source changes are required. The deploy helper works from the ZIP even without Git.

Read [AWS_DEBIAN_DEPLOYMENT.md](AWS_DEBIAN_DEPLOYMENT.md) for firewall commands, certificate renewal, health checks, troubleshooting, secrets, PostgreSQL configuration and rollback before exposing the server publicly. This short path assumes the DNS, AWS security group and SSH access already work.

## E. Update, back up, and restore

For a ZIP update, first back up. Upload the new source ZIP, extract it over the same app folder, then redeploy. Source ZIPs never contain `.env` or database files, so your settings remain in place.

```bash
cd /opt/cortex/cortex
bash scripts/backup.sh
unzip -o ~/NEW-cortex-source.zip -d /opt/cortex
bash scripts/deploy.sh
```

Database volumes retain the same Compose project name across updates. Save the previous image tag from `.env` and the backup so you can roll back using the full guide. If using Git instead of a ZIP: `git pull --ff-only`, then `bash scripts/deploy.sh`.

```bash
bash scripts/backup.sh
bash scripts/restore.sh backups/cortex-TIMESTAMP.dump
```

Restore explicitly asks for confirmation, stops the app and replaces database contents. Copy backups and an encrypted `.env` copy off the server. Local SQLite backup: stop the app and copy `data/cortex.db` (and any `-wal`/`-shm` files if present). Do not copy an actively changing SQLite database without a proper SQLite backup tool.

## If something goes wrong

- **`node`/`npm` not found:** install Node 24 and reopen the terminal.
- **Port in use:** stop the other app on 3000, or change `PORT` and `APP_ORIGIN` together in `.env` for non-Docker local use.
- **Forgot admin password:** rerun `npm run admin:setup` locally or `bash scripts/create-admin.sh` on Debian, then restart/recreate the app. Wait 15 minutes if login is rate limited.
- **No profile or sessions:** run `npm run demo` locally, or create your first profile and invite manually.
- **Invite expired/used:** generate another. Its default is one use.
- **Friend sees pending analysis:** finish the battery and use **Release results**.
- **Lost participant progress:** use the same browser on the same origin. Clearing its cookies removes access; the admin still sees genuine stored data.

This is entertainment software. The tests record real task performance; scores and benchmark percentiles are not clinical or population measurements.
