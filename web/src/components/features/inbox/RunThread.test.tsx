import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RunThread } from '@/components/features/inbox/RunThread';
import type {
  LatestRunResponseDto,
  NoteResponseDto,
  RunStationResponseDto,
} from '@/lib/api';
import type { RunNotes } from '@/lib/run-notes';
import { partial } from '@/test/partial';

const inFlight = vi.fn((): unknown[] => []);

vi.mock('@/hooks/api/useTaskFooterLoading', () => ({
  useTaskFooterLoading: () => false,
}));
vi.mock('@/hooks/api/useSendMessage', () => ({
  useMessagesInFlight: () => inFlight(),
}));

vi.mock('@/hooks/api/useRunNotes', () => ({
  useRunNotes: () => ({
    data: partial<RunNotes>({
      runId: 'run_1',
      station: partial<RunStationResponseDto>({
        name: 'Implementation',
        color: '#5c66d9',
        position: 2,
      }),
      progress: null,
      latestRun: partial<LatestRunResponseDto>({ id: 'run_1' }),
      notes: [
        partial<NoteResponseDto>({
          position: 0,
          runId: 'run_1',
          body: 'Which queue?',
        }),
      ],
    }),
    isPending: false,
    isError: false,
  }),
}));

vi.mock('@/hooks/api/useTaskJournal', () => ({
  useTaskJournal: () => ({ data: [], demand: {}, isPending: false }),
}));

vi.mock('@/hooks/api/useTeamRuns', () => ({
  useTeamRun: () => ({
    data: { id: 'run_1', state: 'completed', progress: null },
  }),
}));

vi.mock('@/hooks/useRunDeciding', () => ({ useRunDeciding: () => undefined }));
vi.mock('@/hooks/useRunProgress', () => ({
  useRunProgress: (_id: unknown, progress: unknown) => progress,
}));
vi.mock('@/hooks/useMe', () => ({
  useMe: () => ({ id: 'user_1', name: 'Sam', image: null }),
}));
vi.mock('@/components/shell/layout/PageHeader', () => ({
  PageHeader: () => null,
}));
vi.mock('@/components/shell/layout/Breadcrumbs', () => ({
  Breadcrumbs: () => null,
}));
vi.mock('@/components/features/runs/RunSidePanel', () => ({
  RunSidePanel: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/features/runs/RunFooter', () => ({
  RunFooter: () => null,
}));
vi.mock('@/components/features/runs/RunConversation', () => ({
  RunConversation: ({ conversation }: { conversation: RunNotes }) => (
    <ul>
      {conversation.notes.map((note) => (
        <li key={note.position}>{note.body}</li>
      ))}
    </ul>
  ),
}));

const renderThread = () =>
  render(
    <RunThread
      slug="acme"
      teamId="team_1"
      taskId="task_1"
      runId="run_1"
      trail={[]}
      after={null}
    />,
  );

describe('RunThread in the inbox', () => {
  beforeEach(() => {
    inFlight.mockReturnValue([]);
  });

  it('shows the saved notes without a message on its way', () => {
    renderThread();

    expect(screen.getByText('Which queue?')).toBeTruthy();
    expect(screen.queryByText('the queue named a')).toBeNull();
  });

  it('shows a message on its way before the server has it', () => {
    inFlight.mockReturnValue([
      {
        teamId: 'team_1',
        runId: 'run_1',
        body: 'the queue named a',
        attachments: [],
        files: [],
        sentAt: Date.parse('2026-10-20T10:00:00.000Z'),
      },
    ]);

    renderThread();

    expect(screen.getByText('the queue named a')).toBeTruthy();
  });
});
