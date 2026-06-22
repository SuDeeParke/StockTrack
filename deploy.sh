#!/bin/bash
set -e
cd /root/stocktrack
echo "[1/5] Git reset & pull"
git checkout -- .
git pull origin main
echo "[2/5] npm install"
npm install --prefer-offline 2>&1 | tail -2
npm install --prefer-offline --prefix server 2>&1 | tail -2
echo "[3/5] Build"
npm run build:full 2>&1 | tail -6
echo "[3.5/5] Copy external packages alongside bundle"
mkdir -p server/dist/node_modules
cp -r server/node_modules/better-sqlite3 server/dist/node_modules/better-sqlite3
cp -r server/node_modules/bcryptjs server/dist/node_modules/bcryptjs
echo "[4/5] Restart service"
systemctl restart stocktrack
sleep 3
echo "[5/5] Verify"
curl -s -o /dev/null -w "GET /          → %{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "GET /api/health → %{http_code}\n" http://localhost:3000/api/health
journalctl -u stocktrack --no-pager -n 5
echo ""
echo "[info] Ensure these are set in /etc/systemd/system/stocktrack.service:"
echo "  Environment=SQLITE_KEY=<64-hex>   # openssl rand -hex 32"
echo "  Environment=JWT_SECRET=<64-hex>   # openssl rand -hex 32"
echo "  Environment=ADMIN_USER=admin"
echo "  Environment=ADMIN_PASS=<password>"
