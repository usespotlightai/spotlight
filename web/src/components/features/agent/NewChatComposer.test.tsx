import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewChatComposer } from '@/components/features/agent/NewChatComposer';
import type { ImprovedStation, SharedTrace } from '@/lib/chat';
import { erase, pressEnter, textOf, write } from '@/test/lexical';

const started = vi.fn();
const harnesses = vi.fn();

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({ data: harnesses() }),
}));
vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [{ fullName: 'acme/api' }] }),
}));
vi.mock('@/hooks/api/useUploadAttachment', () => ({
  useUploadAttachment: () => ({
    mutateAsync: () => Promise.resolve({ id: 'attachment_1' }),
  }),
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

const RETRIES = { taskId: 'task_1', title: 'Drain the stuck retry queues' };

const SPEC: ImprovedStation = {
  lineId: 'line_1',
  lineKey: 'delivery',
  lineName: 'Delivery',
  stationId: 'station_spec',
  stationKey: 'spec',
  stationName: 'Spec',
};

const showing = (
  onStarted = vi.fn(),
  traces: readonly SharedTrace[] = [],
  improving: ImprovedStation | null = null,
) => {
  render(
    <NewChatComposer
      slug="acme"
      teamId="team_1"
      traces={traces}
      improving={improving}
      onStarted={onStarted}
    />,
  );

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

    await write(box(), 'Plan the retries');
    await pressEnter(box());

    expect(started).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        harness: 'claude-code',
        model: null,
        effort: null,
        repositories: [],
        body: 'Plan the retries',
        attachments: [],
        traces: [],
      },
      expect.anything(),
    );
  });

  it('opens the chat it started', async () => {
    started.mockImplementation((_input, { onSuccess }) =>
      onSuccess({ id: 'chat_1' }),
    );
    const { onStarted } = showing();

    await write(box(), 'Plan the retries');
    await pressEnter(box());

    expect(onStarted).toHaveBeenCalledWith('chat_1');
    expect(textOf(box())).toBe('');
  });

  it('shares the traces it was handed, and may start with nothing typed', async () => {
    showing(vi.fn(), [RETRIES]);

    expect(
      within(box()).getByText('Drain the stuck retry queues'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(started).toHaveBeenCalledWith(
      expect.objectContaining({ body: '', traces: ['task_1'] }),
      expect.anything(),
    );
  });

  it('lets a handed trace go before starting', async () => {
    showing(vi.fn(), [RETRIES]);

    await erase(box());

    expect(
      within(box()).queryByText('Drain the stuck retry queues'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('improves the station it was handed, and may start with nothing typed', async () => {
    showing(vi.fn(), [], SPEC);

    expect(
      screen.getByRole('list', { name: 'Station to improve' }),
    ).toHaveTextContent('Spec');
    expect(box()).toHaveAttribute(
      'aria-placeholder',
      'What should it do better?',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(started).toHaveBeenCalledWith(
      expect.objectContaining({ body: '', improving: 'station_spec' }),
      expect.anything(),
    );
  });

  it('lets the handed station go before starting', async () => {
    showing(vi.fn(), [], SPEC);

    await userEvent.click(
      screen.getByRole('button', { name: 'Stop improving Spec' }),
    );
    await write(box(), 'Plan the retries');
    await pressEnter(box());

    expect(
      screen.queryByRole('list', { name: 'Station to improve' }),
    ).not.toBeInTheDocument();
    expect(started.mock.calls[0]?.[0]).not.toHaveProperty('improving');
  });

  it('shows which harness it will talk to', () => {
    showing();

    expect(screen.getByRole('button', { name: /^Agent/ })).toHaveTextContent(
      'Claude Code',
    );
  });

  it('holds the message while there is no harness to talk to', () => {
    harnesses.mockReturnValue([]);
    showing();

    expect(box()).toHaveAttribute('contenteditable', 'false');
  });

  it('puts a file it was given inline where the cursor is, and an image above the text', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    showing();

    await write(box(), 'Look at ');
    await userEvent.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      [
        new File(['{}'], 'agent.json', { type: 'application/json' }),
        new File(['png'], 'shot.png', { type: 'image/png' }),
      ],
    );

    expect(within(box()).getByText('agent.json')).toBeInTheDocument();
    expect(within(box()).queryByText('shot.png')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Images' })).getByRole('img', {
        name: 'shot.png',
      }),
    ).toBeInTheDocument();
  });

  it('sends a file with the message, and lets it go when its token is deleted', async () => {
    showing();
    const picker = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await userEvent.upload(
      picker,
      new File(['{}'], 'agent.json', { type: 'application/json' }),
    );
    await screen.findByRole('button', { name: 'Send' });
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled(),
    );
    await erase(box());

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    await userEvent.upload(
      picker,
      new File(['{}'], 'agent.json', { type: 'application/json' }),
    );
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(started).toHaveBeenCalledWith(
      expect.objectContaining({ body: '', attachments: ['attachment_1'] }),
      expect.anything(),
    );
  });
});
