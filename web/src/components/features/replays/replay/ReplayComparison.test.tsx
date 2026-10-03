import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ReplayComparison } from '@/components/features/replays/replay/ReplayComparison';
import type { EntryComparison, ReplayDetail, ReplayEntry } from '@/lib/replay';

const entry = (over: Partial<ReplayEntry> = {}): ReplayEntry => ({
  position: 0,
  originalRunId: 'run_a',
  taskId: 'task_a',
  runId: 'run_a_replayed',
  fingerprint: null,
  phase: 'settled',
  ending: 'completed',
  refusal: null,
  failure: null,
  next: null,
  ms: 60_000,
  steps: 10,
  cost: { amount: 0.5, currency: 'USD' },
  inputTokens: null,
  outputTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  checks: null,
  judge: null,
  draftingSpent: null,
  judgingSpent: null,
  result: 'succeeded',
  succeeded: true,
  reasons: [],
  ...over,
});

const compared = (
  title: string,
  over: Partial<EntryComparison> = {},
): EntryComparison => ({
  originalRunId: `run_${title}`,
  taskId: `task_${title}`,
  title,
  candidate: entry({ runId: `run_${title}_candidate` }),
  baseline: entry({ runId: `run_${title}_baseline` }),
  costDelta: 0.1,
  msDelta: null,
  stepsDelta: null,
  scoreDelta: null,
  scoreUncompared: null,
  regressed: false,
  ...over,
});

const detail = (comparison: EntryComparison[]): ReplayDetail =>
  ({
    id: 'replay_1',
    ceiling: { amount: 5, currency: 'USD' },
    comparison,
  }) as unknown as ReplayDetail;

const renderComparison = (comparison: EntryComparison[]) =>
  render(
    <MemoryRouter>
      <ReplayComparison
        slug="acme"
        teamId="team_1"
        replay={detail(comparison)}
        picked={null}
        onPick={() => {}}
      />
    </MemoryRouter>,
  );

const taskTitles = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent);

describe('ReplayComparison', () => {
  it('lists the tasks that regressed first, saying so', () => {
    renderComparison([
      compared('Steady'),
      compared('Worse', {
        regressed: true,
        candidate: entry({
          result: 'failed',
          succeeded: false,
          reasons: [
            { code: 'check-failed', detail: 'npm test', steps: [], hunks: [] },
          ],
        }),
      }),
    ]);

    expect(taskTitles()).toEqual(['WorseRegressed', 'Steady']);
    expect(screen.getByText('Its checks failed: npm test')).toBeInTheDocument();
  });

  it('leads to the original run and to both replay runs', () => {
    renderComparison([compared('Steady')]);

    expect(screen.getByRole('link', { name: 'Steady' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/runs/run_Steady',
    );
    expect(
      screen
        .getAllByRole('link', { name: 'Run' })
        .map((each) => each.getAttribute('href')),
    ).toEqual([
      '/w/acme/team/team_1/runs/run_Steady_candidate',
      '/w/acme/team/team_1/runs/run_Steady_baseline',
    ]);
  });

  it('says why two judge scores could not be compared', () => {
    renderComparison([compared('Steady', { scoreUncompared: 'other-rubric' })]);

    expect(screen.getByText('Judged by different rubrics')).toBeInTheDocument();
  });

  it('shows each task’s own cost, and no baseline column, where nothing was compared', () => {
    renderComparison([compared('Alone', { baseline: null, costDelta: null })]);

    expect(
      screen.queryByRole('columnheader', { name: 'Baseline' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Cost' }),
    ).toBeInTheDocument();
    expect(screen.getByText('$0.50')).toBeInTheDocument();
  });
});
