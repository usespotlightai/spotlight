import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ChatThread } from '@/components/features/agent/ChatThread';
import type { Chat } from '@/lib/chat';
import type { JournalledRun, RunJournal } from '@/lib/inbox';

vi.mock('@/hooks/useJournalSight', () => ({
  useJournalSight: () => () => undefined,
}));

const chat = (over: Partial<Chat> = {}) =>
  ({
    id: 'chat_1',
    title: 'Plan the retries',
    harness: 'claude-code',
    model: null,
    effort: null,
    repositories: [],
    createdAt: '2026-08-29T09:00:00.000Z',
    updatedAt: '2026-08-29T09:00:00.000Z',
    progress: null,
    runId: 'run_2',
    targetStation: null,
    messages: [
      {
        position: 0,
        kind: 'message',
        body: 'Help me plan the retries.',
        at: '2026-08-29T09:00:00.000Z',
        author: { id: 'user_1', name: 'Leon', image: null },
        runId: 'run_1',
        takenUpBy: 'run_1',
        attachments: [],
        traces: [],
        proposal: null,
      },
    ],
    ...over,
  }) as unknown as Chat;

const run = (over: Partial<JournalledRun>): JournalledRun => ({
  runId: 'run_1',
  createdAt: '2026-08-29T09:00:01.000Z',
  stepCount: 4,
  messageCount: 1,
  ...over,
});

const journalOf = (runId: string, count: number) =>
  ({
    runId,
    attempt: 1,
    steps: Array.from({ length: count }, (_, at) => ({
      kind: 'tool',
      text: `src/file-${at}.ts`,
      status: 'completed',
      tool: 'read',
      detail: null,
      ms: 10,
      startedAt: `2026-08-29T09:00:0${at + 2}.000Z`,
      locations: [],
      input: null,
      output: null,
      change: null,
    })),
  }) as unknown as RunJournal;

const thread = (
  journals: RunJournal[],
  runs: JournalledRun[],
  over: Partial<Chat> = {},
) => (
  <MemoryRouter>
    <ChatThread
      slug="acme"
      teamId="team_1"
      chat={chat(over)}
      journals={journals}
      runs={runs}
      footer={null}
    />
  </MemoryRouter>
);

describe('ChatThread', () => {
  it('reserves a loading row for a run whose journal has not loaded', () => {
    render(thread([], [run({})]));

    const toggle = screen.getByRole('button', { name: 'Loading · 4 steps' });

    expect(toggle).toBeDisabled();
    expect(toggle.parentElement).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(/Worked/)).not.toBeInTheDocument();
  });

  it('replaces the loading row with the steps when the journal arrives', () => {
    const { rerender } = render(thread([], [run({})]));

    rerender(thread([journalOf('run_1', 4)], [run({})]));

    expect(
      screen.queryByRole('button', { name: /Loading/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Worked · 4 steps' }),
    ).toBeEnabled();
  });

  it('reserves no row for a run without steps', () => {
    render(thread([], [run({ stepCount: 0 })]));

    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });

  it('reserves no row for the run that is still working', () => {
    render(
      thread([], [run({ runId: 'run_2', stepCount: 1 })], {
        progress: 'in-progress',
      }),
    );

    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });
});
