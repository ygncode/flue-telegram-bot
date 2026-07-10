import { defineAgent } from '@flue/runtime';
import { channel, postMessage } from '../channels/telegram.ts';
import instructions from './telegram-assistant.md?raw';

export default defineAgent(({ id }) => ({
  model: 'opencode-go/deepseek-v4-pro',
  instructions,
  tools: [postMessage(channel.parseConversationKey(id))],
}));
