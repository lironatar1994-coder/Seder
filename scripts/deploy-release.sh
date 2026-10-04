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

# Keep two ready-to-run rollbacks. Older releases retain their source, lockfile
# and configuration; only npm dependencies and Next's rebuildable output go.
prune_previous_builds() {
  local name dir target leaf kept=0
  while IFS= read -r name; do
    [[ "$name" =~ ^Seder.previous-[0-9]{8}-[0-9]{6}-[a-f0-9]{8}$ ]] || continue
    dir="/root/$name"
    [[ ! -L "$dir" && "$(readlink -f "$dir")" = "$dir" && -f "$dir/RELEASE.json" && -f "$dir/package-lock.json" ]] || continue
    kept=$((kept + 1))
    [[ "$kept" -gt 2 ]] || continue
    for leaf in node_modules .next; do
      target="$dir/$leaf"
      if [[ -d "$target" && ! -L "$target" && "$(readlink -f "$target")" = "$dir/$leaf" ]]; then
        rm -rf -- "$target"
        echo "[INFO] Removed rebuildable $leaf from older rollback $name; source and configuration retained."
      fi
    done
  done < <(find /root -mindepth 1 -maxdepth 1 -type d -name 'Seder.previous-*' -printf '%f\n' | LC_ALL=C sort -r)
}

prune_previous_builds
available_kb=$(df -Pk /root | awk 'NR == 2 { print $4 }')
[[ "$available_kb" -ge 2097152 ]] || { echo '[ERROR] At least 2 GiB of free disk space is required before building a release. Production was not changed.' >&2; exit 1; }
[[ ! -e "$release" && ! -e "$previous" ]] || exit 2
install -d -m 700 "$backup"
install -d -m 755 "$release"
tar -xzf "$archive" -C "$release"
printf '{"commit":"%s","release":"%s"}\n' "$commit" "$release_id" > "$release/RELEASE.json"
[[ ! -f "$nginx" ]] || cp -p "$nginx" "$backup/nginx.conf"
[[ ! -f "$current/.env.production" ]] || cp -p "$current/.env.production" "$backup/environment.env"
robots_target=''
if [ -d /opt/lawebs-portfolio/www/current ]; then
  portfolio_root=$(readlink -f /opt/lawebs-portfolio/www/current)
  [[ "$portfolio_root" == /opt/lawebs-portfolio/* ]] || exit 2
  robots_target="$portfolio_root/robots.txt"
  [[ ! -f "$robots_target" ]] || cp -p "$robots_target" "$backup/portfolio-robots.txt"
fi
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
    if [ -n "$robots_target" ] && [ -f "$backup/portfolio-robots.txt" ]; then cp -p "$backup/portfolio-robots.txt" "$robots_target"; fi
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
prune_previous_builds
echo "[SUCCESS] Production is serving Git commit $commit. Previous release: $previous. Backup: $backup"
