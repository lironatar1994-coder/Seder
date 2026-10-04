#!/usr/bin/env bash
set -Eeuo pipefail
archive="${1:?archive required}"
release_id="${2:?release id required}"
commit="${3:?commit required}"
[[ "$release_id" =~ ^[0-9]{8}-[0-9]{6}-[a-f0-9]{8}$ ]] || exit 2
[[ "$commit" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$archive" = "/tmp/seder-$release_id.tar.gz" ]] || exit 2
current='/root/Seder'
release="/root/Seder.releases/$release_id"
previous="/root/Seder.previous-$release_id"
database='/var/lib/seder/seder.db'
backup="/root/deployment-backups/seder/$release_id"
nginx='/etc/nginx/sites-available/lawebs.co.il.conf'
install -d -m 700 /root/deployment-backups/seder /root/Seder.releases
exec 9>/var/lock/seder-deploy.lock
flock -n 9 || { echo '[ERROR] Another Seder release is running.' >&2; exit 1; }
[[ ! -e "$release" && ! -e "$previous" ]] || exit 2
install -d -m 700 "$backup"
install -d -m 755 "$release"
tar -xzf "$archive" -C "$release"
printf '{"commit":"%s","release":"%s"}\n' "$commit" "$release_id" > "$release/RELEASE.json"
[[ ! -f "$nginx" ]] || cp -p "$nginx" "$backup/nginx.conf"
[[ ! -f "$current/.env.production" ]] || cp -p "$current/.env.production" "$backup/environment.env"
paused=0
switched=0
rollback() {
  code=$?
  trap - ERR
  set +e
  if [ "$paused" = 1 ]; then
    pm2 stop seder-live seder-whatsapp >/dev/null 2>&1
    pm2 stop seder-calendar >/dev/null 2>&1 || true
    if [ "$switched" = 1 ]; then
      mv "$current" "$release.failed"
      [[ ! -d "$previous" ]] || mv "$previous" "$current"
    fi
    if [ -f "$backup/database.db" ]; then
      # Both consumers are stopped; restore the consistent snapshot atomically.
      rm -f -- /var/lib/seder/seder.db-wal /var/lib/seder/seder.db-shm
      install -m 600 "$backup/database.db" "$database"
    fi
    if [ -f "$backup/nginx.conf" ]; then cp -p "$backup/nginx.conf" "$nginx"; nginx -t && systemctl reload nginx; fi
    (cd "$current" && pm2 startOrReload ecosystem.config.cjs --update-env) || true
    pm2 save --force >/dev/null 2>&1
  fi
  echo "[ERROR] Release failed. Previous release restored when activation had begun. Backup: $backup" >&2
  exit "$code"
}
trap rollback ERR
(cd "$release" && bash ./deploy_linux.sh prepare)
echo '[INFO] Stopping writes briefly for the database backup and release switch...'
paused=1
pm2 stop seder-live seder-whatsapp >/dev/null
pm2 stop seder-calendar >/dev/null 2>&1 || true
if [ -f "$database" ]; then sqlite3 "$database" ".backup '$backup/database.db'"; chmod 600 "$backup/database.db"; fi
(cd "$release" && DATABASE_URL="file:$database" npx prisma migrate deploy)
mv "$current" "$previous"
switched=1
mv "$release" "$current"
(cd "$current" && bash ./deploy_linux.sh activate)
for attempt in $(seq 1 30); do
  if curl -fsS 'http://127.0.0.1:3107/seder/api/health' | grep -q "$commit"; then break; fi
  if [ "$attempt" = 30 ]; then echo '[ERROR] New release did not pass the health check.' >&2; false; fi
  sleep 1
done
curl -fsS 'https://lawebs.co.il/seder/api/health' | grep -q "$commit"
trap - ERR
rm -f -- "$archive"
echo "[SUCCESS] Production is serving Git commit $commit. Previous release: $previous. Backup: $backup"
