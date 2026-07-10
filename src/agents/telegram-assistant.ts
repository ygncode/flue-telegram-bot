import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineAgent } from '@flue/runtime';
import { channel, postMessage } from '../channels/telegram.ts';

const instructions = readFileSync(
  join(process.cwd(), 'src/agents/telegram-assistant.md'),
  'utf8',
);

export default defineAgent(({ id }) => ({
  model: 'opencode-go/deepseek-v4-pro',
  instructions,
  tools: [postMessage(channel.parseConversationKey(id))],
}));
