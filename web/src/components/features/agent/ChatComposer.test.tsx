import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatComposer } from '@/components/features/agent/ChatComposer';
import type { Chat } from '@/lib/chat';
import { pressEnter, textOf, write } from '@/test/lexical';

const sent = vi.fn();

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [
      {
        id: 'claude-code',
        name: 'Claude Code',
        models: [
          { id: 'opus', name: 'Opus' },
          { id: 'sonnet', name: 'Sonnet' },
        ],
        defaultModel: 'opus',
        efforts: ['high'],
      },
    ],
  }),
}));
vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [] }),
}));
vi.mock('@/hooks/api/useStopChat', () => ({
  useStopChat: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/api/useSendChatMessage', () => ({
  useSendChatMessage: () => ({ mutate: sent, isPending: false }),
}));

const chat = (id: string, overrides: Partial<Chat> = {}): Chat =>
  ({
    id,
    harness: 'claude-code',
    model: null,
    effort: null,
    repositories: [],
    progress: 'idle',
    ...overrides,
  }) as unknown as Chat;

const showing = (shown: Chat) =>
  render(<ChatComposer slug="acme" teamId="team_1" chat={shown} />);

const box = () => screen.getByRole('textbox', { name: 'Message the agent' });

beforeEach(() => {
  localStorage.clear();
  sent.mockReset();
});

describe('ChatComposer', () => {
  it('brings back the reply that was being written', async () => {
    showing(chat('chat_1'));
    await write(box(), 'Half a reply');
    cleanup();
    showing(chat('chat_1'));

    expect(textOf(box())).toBe('Half a reply');
  });

  it('keeps the reply of one chat out of another', async () => {
    showing(chat('chat_1'));
    await write(box(), 'For one');
    cleanup();
    showing(chat('chat_2'));
    await write(box(), 'For two');
    cleanup();

    showing(chat('chat_1'));
    expect(textOf(box())).toBe('For one');
    cleanup();
    showing(chat('chat_2'));
    expect(textOf(box())).toBe('For two');
  });

  it('uses the model of the chat until settings were saved', async () => {
    showing(chat('chat_1', { model: 'sonnet' }));
    await write(box(), 'Hi');
    await pressEnter(box());

    expect(sent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'sonnet' }),
      expect.anything(),
    );
  });

  it('prefers the saved model over the model of the chat', async () => {
    localStorage.setItem(
      'spotlight.chat-drafts.acme',
      JSON.stringify({
        'chat:chat_1': {
          text: 'Hi',
          references: [],
          attachments: [],
          savedAt: Date.now(),
          prefill: '',
          model: 'opus',
        },
      }),
    );
    showing(chat('chat_1', { model: 'sonnet' }));
    await pressEnter(box());

    expect(sent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'opus' }),
      expect.anything(),
    );
  });

  it('empties the box after a reply was sent', async () => {
    sent.mockImplementation((_input, { onSuccess }) => onSuccess());
    showing(chat('chat_1'));
    await write(box(), 'Done');
    await pressEnter(box());
    cleanup();
    showing(chat('chat_1'));

    expect(textOf(box())).toBe('');
  });
});
