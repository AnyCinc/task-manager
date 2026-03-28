#!/bin/bash
# TaskFlow トンネルURLを表示するスクリプト
grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cloudflared.log 2>/dev/null | tail -1 || echo "トンネルURLが見つかりません。ログ確認: cat /tmp/cloudflared.log"
