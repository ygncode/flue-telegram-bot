# Telegram Flue Bot

A local-first Telegram assistant built with Flue, Telegram webhooks, and OpenCode Go's DeepSeek V4 Pro.

## Setup

```bash
cp .env.example .env
# Fill in OPENCODE_API_KEY, TELEGRAM_BOT_TOKEN, and TELEGRAM_WEBHOOK_SECRET_TOKEN
npx flue dev --target node
```

The local server listens at `http://localhost:3583`. Telegram webhooks require a public HTTPS URL; use a tunnel such as ngrok or Cloudflare Tunnel, then set:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://YOUR_PUBLIC_HOST/channels/telegram/webhook","secret_token":"'"$TELEGRAM_WEBHOOK_SECRET_TOKEN"'"}'
```

To test the agent without Telegram:

```bash
npx flue run telegram-assistant --target node --input '{"message":"Say hello"}'
```
