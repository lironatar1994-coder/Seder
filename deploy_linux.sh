#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(pwd -P)"
PHASE="${1:-deploy}"
APP_NAME='seder-live'
WORKER_NAME='seder-whatsapp'
APP_PORT='3107'
DOMAIN='lawebs.co.il'
BASE_PATH='/seder'
DATA_DIR='/var/lib/seder'
DATABASE_FILE="$DATA_DIR/seder.db"
BACKUP_DIR='/root/deployment-backups/seder'
NGINX_AVAILABLE='/etc/nginx/sites-available/lawebs.co.il.conf'
NGINX_ENABLED='/etc/nginx/sites-enabled/lawebs.co.il.conf'
VISITOR_SIGNAL_KEY_FILE="${VISITOR_SIGNAL_KEY_FILE:-/root/.visitor-signal-key}"
VISITOR_SIGNAL_SNIPPET='/etc/nginx/snippets/visitor-signal-seder.conf'
MONITOR_SIGNAL_URL="${SERVER_MONITOR_SIGNAL_URL:-http://127.0.0.1:4010/serve-monitor/api/browser-signals/site}"

if [ "$(id -u)" -ne 0 ]; then
  echo '[ERROR] Run deploy_linux.sh as root.' >&2
  exit 1
fi
if [[ "$APP_ROOT" != /root/Seder && "$APP_ROOT" != /root/Seder.releases/* ]] || [ ! -f package.json ] || [ ! -f next.config.ts ]; then
  echo "[ERROR] Run this script from $APP_ROOT." >&2
  exit 1
fi

install -d -m 700 "$DATA_DIR" "$BACKUP_DIR"

# The domain also serves the portfolio. Preserve its live routing on updates.
if [ -f "$NGINX_AVAILABLE" ]; then
  if ! grep -Fq "location ~ ^$BASE_PATH" "$NGINX_AVAILABLE" || ! grep -Fq "proxy_pass http://127.0.0.1:$APP_PORT;" "$NGINX_AVAILABLE"; then
    echo '[ERROR] Existing domain routing does not contain the expected Seder upstream.' >&2
    exit 1
  fi
fi

# Kept outside the release directory on purpose. Deploying replaces
# /root/Seder wholesale, and pairing state inside it would mean re-scanning the
# WhatsApp QR after every single deploy.
WHATSAPP_AUTH_DIR="$DATA_DIR/whatsapp-auth"
WHATSAPP_STATUS_FILE="$DATA_DIR/whatsapp-status.json"
install -d -m 700 "$WHATSAPP_AUTH_DIR"

# Secrets that must survive a release: written once by hand on the server,
# sourced back in here. Absent is fine — the WhatsApp rewrite fallback simply
# stays off, and the pairing code is shown to nobody.
SECRETS_FILE="$DATA_DIR/secrets.env"
if [ -f "$SECRETS_FILE" ]; then
  # shellcheck disable=SC1090
  . "$SECRETS_FILE"
fi

cat > .env.production <<ENV
DATABASE_URL="file:$DATABASE_FILE"
APP_URL="https://$DOMAIN$BASE_PATH"
MAIL_FROM="${MAIL_FROM:-סדר <no-reply@$DOMAIN>}"
RESEND_API_KEY="${RESEND_API_KEY:-}"
WHATSAPP_AUTH_DIR="$WHATSAPP_AUTH_DIR"
WHATSAPP_STATUS_FILE="$WHATSAPP_STATUS_FILE"
SEDER_ADMIN_EMAIL="${SEDER_ADMIN_EMAIL:-}"
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
SMTP_URL="${SMTP_URL:-}"
WHATSAPP_DEBUG="${WHATSAPP_DEBUG:-}"
WHATSAPP_OUTAGE_MINUTES="${WHATSAPP_OUTAGE_MINUTES:-}"
WHATSAPP_MORNING_HOUR="${WHATSAPP_MORNING_HOUR:-}"
WHATSAPP_REMINDER_LEAD="${WHATSAPP_REMINDER_LEAD:-}"
WHATSAPP_DAILY_CAP="${WHATSAPP_DAILY_CAP:-}"
ENV
chmod 600 .env.production

if [ "$PHASE" != activate ]; then
echo '[INFO] Installing production dependencies...'
npm ci --silent

echo '[INFO] Applying database migrations...'
if [ "$PHASE" != prepare ]; then DATABASE_URL="file:$DATABASE_FILE" npx prisma migrate deploy; fi

echo '[INFO] Building Seder...'
DATABASE_URL="file:$DATABASE_FILE" APP_URL="https://$DOMAIN$BASE_PATH" npm run build
fi

if [ "$PHASE" = prepare ]; then
  echo '[SUCCESS] Release built; production is still serving the previous version.'
  exit 0
fi

echo '[INFO] Starting Seder...'
pm2 startOrReload ecosystem.config.cjs --only "$APP_NAME" --update-env

# Reloaded separately, and never fatal. A WhatsApp socket that will not come up
# is a degraded feature; the site failing to deploy because of it would be a
# worse outcome than the feature being down.
if ! pm2 startOrReload ecosystem.config.cjs --only "$WORKER_NAME" --update-env; then
  echo "[WARN] $WORKER_NAME did not reload. The site is up; WhatsApp is not." >&2
fi

pm2 save --force >/dev/null

for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$APP_PORT$BASE_PATH" >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo '[ERROR] Seder did not become healthy on its internal port.' >&2
    pm2 logs "$APP_NAME" --lines 80 --nostream >&2 || true
    exit 1
  fi
  sleep 1
done

echo '[INFO] Configuring the domain...'
SIGNAL_KEY="$(tr -d '\r\n' < "$VISITOR_SIGNAL_KEY_FILE")"
if ! printf '%s' "$SIGNAL_KEY" | grep -Eq '^[[:xdigit:]]{64}$'; then
  echo "[ERROR] $VISITOR_SIGNAL_KEY_FILE must contain one 64-character hexadecimal key." >&2
  exit 1
fi
cat > "$VISITOR_SIGNAL_SNIPPET" <<NGINX
location = $BASE_PATH/.well-known/vee-visitor-signal {
    limit_except POST { deny all; }
    client_max_body_size 16k;
    proxy_pass $MONITOR_SIGNAL_URL;
    proxy_http_version 1.1;
    proxy_set_header Content-Type application/json;
    proxy_set_header X-Visitor-Signal-Key "$SIGNAL_KEY";
    proxy_set_header X-Visitor-Site-Url "https://$DOMAIN$BASE_PATH";
    proxy_set_header X-Visitor-IP \$remote_addr;
    proxy_set_header X-Visitor-User-Agent \$http_user_agent;
}
NGINX
chmod 600 "$VISITOR_SIGNAL_SNIPPET"

if [ ! -f "$NGINX_AVAILABLE" ]; then
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  cat > "$NGINX_AVAILABLE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://$DOMAIN\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://$DOMAIN\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;
    include $VISITOR_SIGNAL_SNIPPET;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 2m;

    location ~ ^$BASE_PATH(?:/|\$) {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port 443;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass \$http_upgrade;
    }

    location / {
        return 404;
    }
}
NGINX
else
  cat > "$NGINX_AVAILABLE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    include $VISITOR_SIGNAL_SNIPPET;

    location ~ ^$BASE_PATH(?:/|\$) {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port 80;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        return 404;
    }
}
NGINX
fi
fi

ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"
nginx -t
systemctl reload nginx

if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo '[INFO] Issuing the HTTPS certificate...'
  certbot --nginx --non-interactive --agree-tos --redirect \
    --register-unsafely-without-email \
    -d "$DOMAIN" -d "www.$DOMAIN"
  nginx -t
  systemctl reload nginx
fi

echo "[SUCCESS] Seder deployed at https://$DOMAIN$BASE_PATH"
