# Flue Telegram Bot

A Telegram AI assistant built with [Flue](https://flueframework.com/), OpenCode Go, and DeepSeek V4 Pro.

## Requirements

- Node.js 22.19+
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- OpenCode Go API key
- A public HTTPS endpoint for Telegram webhooks

## Local setup

```bash
npm install
cp .env.example .env
```

Set these values in `.env`:

```env
OPENCODE_API_KEY="..."
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_WEBHOOK_SECRET_TOKEN="..."
TELEGRAM_OWNER_USER_ID="..."
```

Start the development server:

```bash
npx flue dev --target node
```

The server listens on `http://localhost:3583`.

## Tailscale Funnel

Expose the local server:

```bash
tailscale funnel --bg 3583
```

Set the Telegram webhook using the public Funnel hostname:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://YOUR_TAILSCALE_HOST/channels/telegram/webhook","secret_token":"'"$TELEGRAM_WEBHOOK_SECRET_TOKEN"'"}'
```

## Group approval

Anyone can add the bot to a group, but unapproved groups are ignored. The configured owner can approve a group by sending:

```text
@laravel_myanmar_bot approve
```

Approved groups respond only to mentions, commands, and replies to the bot. Approved group IDs are stored locally in `data/approved-chats.json`.

## System prompt

The assistant instructions are stored locally in:

```text
src/agents/telegram-assistant.md
```

This file is intentionally gitignored because it may contain private instructions.

## Validation

```bash
npx tsc --noEmit
npx flue build --target node
```
