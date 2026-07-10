import { createTelegramChannel, type TelegramConversationRef } from '@flue/telegram';
import { defineTool, dispatch } from '@flue/runtime';
import { Api } from 'grammy';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Message } from 'grammy/types';
import * as v from 'valibot';
import assistant from '../agents/telegram-assistant.ts';

export const client = new Api(process.env.TELEGRAM_BOT_TOKEN!);

export const channel = createTelegramChannel({
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN!,
  async webhook({ update }) {
    console.log('[telegram] update received', update.update_id, Object.keys(update));
    const incoming = update.message ?? update.channel_post ?? update.business_message;
    if (!incoming) return;

    if (incoming.chat.type !== 'private') {
      if (isApprovalRequest(incoming) && isOwner(incoming)) {
        approveChat(incoming.chat.id);
        await client.sendMessage(incoming.chat.id, '✅ This group is approved. Mention me or reply to me to use the bot.', {
          ...(incoming.message_thread_id
            ? { message_thread_id: incoming.message_thread_id }
            : {}),
        });
        return;
      }

      // Unapproved groups can add the bot, but it ignores everything else.
      if (!isApprovedChat(incoming.chat.id)) return;

      // Approved groups only handle mentions, commands, and replies.
      if (!shouldHandleGroupMessage(incoming)) return;
    }

    await dispatch(assistant, {
      id: channel.conversationKey(conversationFromMessage(incoming)),
      input: {
        type: 'telegram.message',
        updateId: update.update_id,
        message: incoming,
      },
    });
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

function isApprovedChat(chatId: number): boolean {
  return approvedChats().has(String(chatId));
}

function approveChat(chatId: number): void {
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
    description: 'Send a text reply to the current Telegram conversation.',
    input: v.object({ text: v.pipe(v.string(), v.minLength(1)) }),
    async run({ input: { text } }) {
      const message = await client.sendMessage(ref.chatId, text, {
        ...(ref.type === 'business-chat'
          ? { business_connection_id: ref.businessConnectionId }
          : {}),
        ...(ref.messageThreadId ? { message_thread_id: ref.messageThreadId } : {}),
      });
      return { messageId: message.message_id };
    },
  });
}
