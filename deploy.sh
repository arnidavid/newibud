#!/bin/bash
# ============================================================
# deploy.sh — ibud v2 deploy script
# Sendir allar skrár á Docker host
# Keyra frá Mac: bash deploy.sh
# ============================================================

SERVER="root@192.168.100.204"
REMOTE_DIR="/root/docker_volumes/ibud/html"

echo "🚀 Deploying ibud v2 to $SERVER..."

# Skrár til að senda
FILES=(
  "index.html"
  "api.js"
  "app.js"
  "style.css"
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    echo "  📄 $f"
    scp "$f" "$SERVER:$REMOTE_DIR/$f"
  else
    echo "  ⚠️  $f vantar — sleppi"
  fi
done

echo "✅ Deploy lokið!"
echo "🔗 https://ibud.silfran.com"
