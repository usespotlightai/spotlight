import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewChatComposer } from '@/components/features/agent/NewChatComposer';
import type { ImprovedStation, SharedTrace } from '@/lib/chat';

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

    await userEvent.type(box(), 'Plan the retries{Enter}');

    expect(onStarted).toHaveBeenCalledWith('chat_1');
    expect(box()).toHaveValue('');
  });

  it('shares the traces it was handed, and may start with nothing typed', async () => {
    showing(vi.fn(), [RETRIES]);

    expect(
      screen.getByRole('list', { name: 'Traces to share' }),
    ).toHaveTextContent('Drain the stuck retry queues');

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(started).toHaveBeenCalledWith(
      expect.objectContaining({ body: '', traces: ['task_1'] }),
      expect.anything(),
    );
  });

  it('lets a handed trace go before starting', async () => {
    showing(vi.fn(), [RETRIES]);

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove the trace of Drain the stuck retry queues',
      }),
    );

    expect(
      screen.queryByRole('list', { name: 'Traces to share' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('improves the station it was handed, and may start with nothing typed', async () => {
    showing(vi.fn(), [], SPEC);

    expect(
      screen.getByRole('list', { name: 'Station to improve' }),
    ).toHaveTextContent('Spec');
    expect(box()).toHaveAttribute('placeholder', 'What should it do better?');

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
    await userEvent.type(box(), 'Plan the retries{Enter}');

    expect(
      screen.queryByRole('list', { name: 'Station to improve' }),
    ).not.toBeInTheDocument();
    expect(started.mock.calls[0]?.[0]).not.toHaveProperty('improving');
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
