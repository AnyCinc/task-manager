#!/bin/bash
# トンネルURLが変わったらTeams Webhookに通知するスクリプト
URL_FILE="/tmp/taskflow-tunnel-url.txt"
LOG_FILE="/tmp/cloudflared.log"

# 現在のURL取得
CURRENT_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG_FILE" 2>/dev/null | tail -1)

if [ -z "$CURRENT_URL" ]; then
  exit 0
fi

# 前回のURLと比較
PREV_URL=$(cat "$URL_FILE" 2>/dev/null)

if [ "$CURRENT_URL" != "$PREV_URL" ]; then
  echo "$CURRENT_URL" > "$URL_FILE"

  # Webhook URLを取得
  WEBHOOK_URL=$(cat /Users/hitokiwa/Desktop/task-manager/.webhook 2>/dev/null)

  if [ -n "$WEBHOOK_URL" ]; then
    curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"message\",\"text\":\"TaskFlowのURLが更新されました👇\n${CURRENT_URL}\",\"attachments\":[{\"contentType\":\"application/vnd.microsoft.card.adaptive\",\"content\":{\"\$schema\":\"http://adaptivecards.io/schemas/adaptive-card.json\",\"type\":\"AdaptiveCard\",\"version\":\"1.4\",\"body\":[{\"type\":\"TextBlock\",\"text\":\"🔄 TaskFlow URL更新\",\"weight\":\"bolder\",\"size\":\"medium\",\"color\":\"accent\"},{\"type\":\"TextBlock\",\"text\":\"TaskFlowのURLが変わりました。新しいURLはこちら👇\",\"wrap\":true,\"size\":\"small\"},{\"type\":\"TextBlock\",\"text\":\"${CURRENT_URL}\",\"wrap\":true,\"size\":\"medium\",\"weight\":\"bolder\",\"color\":\"accent\"}],\"msteams\":{\"width\":\"Full\"}}}]}"
  fi

  echo "$(date): URL changed to $CURRENT_URL"
fi
