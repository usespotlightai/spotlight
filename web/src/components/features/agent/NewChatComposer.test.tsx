import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewChatComposer } from '@/components/features/agent/NewChatComposer';

const started = vi.fn();
const harnesses = vi.fn();

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({ data: harnesses() }),
}));
vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [{ fullName: 'acme/api' }] }),
}));
vi.mock('@/hooks/api/useUploadAttachment', () => ({
  useUploadAttachment: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/api/useStartChat', () => ({
  useStartChat: () => ({ mutate: started, isPending: false }),
}));

const CLAUDE = {
  id: 'claude-code',
  name: 'Claude Code',
  executable: 'claude-agent-acp',
  models: [],
  defaultModel: '',
  efforts: [],
  discovery: [],
};

const showing = (onStarted = vi.fn()) => {
  render(<NewChatComposer slug="acme" teamId="team_1" onStarted={onStarted} />);

  return { onStarted };
};

const box = () => screen.getByRole('textbox', { name: 'Plan with the agent' });

beforeEach(() => {
  localStorage.clear();
  started.mockReset();
  harnesses.mockReturnValue([CLAUDE]);
});

describe('NewChatComposer', () => {
  it('starts a chat with the first harness when none was chosen before', async () => {
    showing();

    await userEvent.type(box(), 'Plan the retries{Enter}');

    expect(started).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        harness: 'claude-code',
        model: null,
        effort: null,
        repositories: [],
        body: 'Plan the retries',
        attachments: [],
      },
      expect.anything(),
    );
  });

  it('opens the chat it started', async () => {
    started.mockImplementation((_input, { onSuccess }) =>
      onSuccess({ id: 'chat_1' }),
    );
    const { onStarted } = showing();

    await userEvent.type(box(), 'Plan the retries{Enter}');

    expect(onStarted).toHaveBeenCalledWith('chat_1');
    expect(box()).toHaveValue('');
  });

  it('shows which harness it will talk to', () => {
    showing();

    expect(screen.getByRole('button', { name: 'Harness' })).toHaveTextContent(
      'Claude Code',
    );
  });

  it('holds the message while there is no harness to talk to', () => {
    harnesses.mockReturnValue([]);
    showing();

    expect(box()).toBeDisabled();
  });
});
