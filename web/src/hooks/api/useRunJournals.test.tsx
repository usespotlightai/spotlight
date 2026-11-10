import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type JournalSource, useRunJournals } from '@/hooks/api/useRunJournals';
import type { RunJournal } from '@/lib/inbox';

const journalOf = (runId: string) => ({ runId, attempt: 1 }) as RunJournal;

const sourceOf = (journal: (runId: string) => Promise<RunJournal[]>) =>
  ({
    runsKey: ['journal-runs', 'task', 'task_1'],
    enabled: true,
    runs: async () =>
      ['run_1', 'run_2', 'run_3'].map((runId, at) => ({
        runId,
        createdAt: new Date(Date.UTC(2026, 10, 1, at)).toISOString(),
        stepCount: 1,
        messageCount: 0,
      })),
    journal,
  }) satisfies JournalSource;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('the journals of a task', () => {
  it('loads the newest run and the runs asked for up front, and no other', async () => {
    const journal = vi.fn(async (runId: string) => [journalOf(runId)]);
    const { result } = renderHook(
      () => useRunJournals(sourceOf(journal), ['run_1']),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data?.map((each) => each.runId)).toEqual([
      'run_1',
      'run_3',
    ]);
    expect(journal.mock.calls.map(([runId]) => runId).sort()).toEqual([
      'run_1',
      'run_3',
    ]);
  });

  it('loads an earlier run once the reader reaches it', async () => {
    const journal = vi.fn(async (runId: string) => [journalOf(runId)]);
    const { result } = renderHook(() => useRunJournals(sourceOf(journal), []), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    act(() => result.current.demand.want(['run_2']));

    await waitFor(() =>
      expect(result.current.data?.map((each) => each.runId)).toEqual([
        'run_2',
        'run_3',
      ]),
    );
    expect(journal).not.toHaveBeenCalledWith('run_1');
  });
});
