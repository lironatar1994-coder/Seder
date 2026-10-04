#!/usr/bin/env bash
set -euo pipefail

# Preserve the portfolio's host-wide crawl policy. A subdirectory robots.txt
# alone is not used by Google. Only add Seder's public sitemap to the root file.
site_link='/opt/lawebs-portfolio/www/current'
entry='Sitemap: https://lawebs.co.il/seder/sitemap.xml'
if [[ ! -d "$site_link" ]]; then
  echo '[INFO] No shared portfolio root; submit the Seder sitemap in Search Console.'
  exit 0
fi
site_root=$(readlink -f -- "$site_link")
[[ "$site_root" == /opt/lawebs-portfolio/* ]] || { echo '[ERROR] Unexpected shared site root.' >&2; exit 1; }
target="$site_root/robots.txt"
[[ -f "$target" && ! -L "$target" ]] || { echo '[ERROR] Existing root robots.txt is required.' >&2; exit 1; }
if grep -Fxq "$entry" "$target"; then exit 0; fi
backup='/root/deployment-backups/seder/seo-discovery'
install -d -m 700 "$backup"
cp -p -- "$target" "$backup/robots-$(date -u +%Y%m%dT%H%M%S).txt"
temporary=$(mktemp "$site_root/.robots.seder.XXXXXX")
trap 'rm -f -- "$temporary"' EXIT
cat -- "$target" > "$temporary"
printf '\n%s\n' "$entry" >> "$temporary"
chmod --reference="$target" "$temporary"
chown --reference="$target" "$temporary"
mv -f -- "$temporary" "$target"
echo '[INFO] Preserved root robots.txt and added the Seder sitemap.'
