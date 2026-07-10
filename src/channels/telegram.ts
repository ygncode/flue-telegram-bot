import { createTelegramChannel, type TelegramConversationRef } from '@flue/telegram';
import { defineTool, dispatch } from '@flue/runtime';
import { Api } from 'grammy';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Message } from 'grammy/types';
import type { Env } from 'hono';
import type { KVNamespace } from '@cloudflare/workers-types';
import * as v from 'valibot';
import assistant from '../agents/telegram-assistant.ts';

export const client = new Api(process.env.TELEGRAM_BOT_TOKEN!);

type AppEnv = Env & {
  Bindings: {
    APPROVED_CHATS?: KVNamespace;
  };
};

export const channel = createTelegramChannel<AppEnv>({
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN!,
  async webhook({ c, update }) {
    const incoming = update.message ?? update.channel_post ?? update.business_message;
    if (!incoming) return;

    if (incoming.chat.type === 'private' && !isOwner(incoming)) return;

    if (incoming.chat.type !== 'private') {
      if (isApprovalRequest(incoming) && isOwner(incoming)) {
        await approveChat(incoming.chat.id, c.env.APPROVED_CHATS);
        await client.sendMessage(incoming.chat.id, '✅ This group is approved. Mention me or reply to me to use the bot.', {
          ...(incoming.message_thread_id
            ? { message_thread_id: incoming.message_thread_id }
            : {}),
        });
        return;
      }

      // Unapproved groups can add the bot, but it ignores everything else.
      if (!(await isApprovedChat(incoming.chat.id, c.env.APPROVED_CHATS))) return;

      // Approved groups only handle mentions, commands, and replies.
      if (!shouldHandleGroupMessage(incoming)) return;
    }

    const typingOptions =
      incoming.message_thread_id === undefined
        ? {}
        : { message_thread_id: incoming.message_thread_id };
    await client.sendChatAction(incoming.chat.id, 'typing', typingOptions);
    const typingInterval = setInterval(() => {
      void client.sendChatAction(incoming.chat.id, 'typing', typingOptions).catch(() => {});
    }, 4_000);

    try {
      await dispatch(assistant, {
        id: channel.conversationKey(conversationFromMessage(incoming)),
        input: {
          type: 'telegram.message',
          updateId: update.update_id,
          message: incoming,
        },
      });
    } finally {
      clearInterval(typingInterval);
    }
  },
});

const dataPath = join(process.cwd(), 'data');
const approvedChatsPath = join(dataPath, 'approved-chats.json');

function getOwnerId(): number | undefined {
  const configured = Number(process.env.TELEGRAM_OWNER_USER_ID);
  return Number.isInteger(configured) && configured > 0 ? configured : undefined;
}

function approvedChats(): Set<string> {
  if (!existsSync(approvedChatsPath)) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(approvedChatsPath, 'utf8')) as string[]);
  } catch {
    return new Set();
  }
}

async function isApprovedChat(chatId: number, kv?: KVNamespace): Promise<boolean> {
  if (kv) return (await kv.get(`approved:${chatId}`)) === '1';
  return approvedChats().has(String(chatId));
}

async function approveChat(chatId: number, kv?: KVNamespace): Promise<void> {
  if (kv) {
    await kv.put(`approved:${chatId}`, '1');
    return;
  }

  const chats = approvedChats();
  chats.add(String(chatId));
  mkdirSync(dataPath, { recursive: true });
  writeFileSync(approvedChatsPath, JSON.stringify([...chats], null, 2) + '\n');
}

function isOwner(message: Message): boolean {
  return message.from?.id === getOwnerId();
}

function isApprovalRequest(message: Message): boolean {
  const text = message.text ?? message.caption ?? '';
  return /@laravel_myanmar_bot/i.test(text) && /\bapprove\b/i.test(text);
}

function shouldHandleGroupMessage(message: Message): boolean {
  const text = message.text ?? message.caption ?? '';
  return (
    text.startsWith('/') ||
    text.toLowerCase().includes('@laravel_myanmar_bot') ||
    message.reply_to_message?.from?.username === 'laravel_myanmar_bot'
  );
}

function conversationFromMessage(message: Message): TelegramConversationRef {
  const topic =
    message.message_thread_id === undefined
      ? {}
      : { messageThreadId: message.message_thread_id };

  return message.business_connection_id
    ? {
        type: 'business-chat',
        businessConnectionId: message.business_connection_id,
        chatId: message.chat.id,
        ...topic,
      }
    : { type: 'chat', chatId: message.chat.id, ...topic };
}

export function postMessage(ref: TelegramConversationRef) {
  return defineTool({
    name: 'post_telegram_message',
    description:
      'Send a text reply to the current Telegram conversation. Text is parsed as Telegram HTML (use <b>, <i>, <code>, <pre>, <a>; escape literal &, <, > as entities).',
    input: v.object({ text: v.pipe(v.string(), v.minLength(1)) }),
    async run({ input: { text } }) {
      const message = await client.sendMessage(ref.chatId, text, {
        parse_mode: 'HTML',
        ...(ref.type === 'business-chat'
          ? { business_connection_id: ref.businessConnectionId }
          : {}),
        ...(ref.messageThreadId ? { message_thread_id: ref.messageThreadId } : {}),
      });
      return { messageId: message.message_id };
    },
  });
}
