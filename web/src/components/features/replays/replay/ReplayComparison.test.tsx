import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReplayComparison } from '@/components/features/replays/replay/ReplayComparison';
import type { EntryComparison, ReplayDetail, ReplayEntry } from '@/lib/replay';

const entry = (over: Partial<ReplayEntry> = {}): ReplayEntry => ({
  position: 0,
  originalRunId: 'run_a',
  taskId: 'task_a',
  repeat: 1,
  runId: 'run_a_replayed',
  fingerprint: null,
  phase: 'settled',
  ending: 'completed',
  unreplayableReason: null,
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
  secondJudge: null,
  rejudgingSpent: null,
  recheck: null,
  pair: null,
  pairingSpent: null,
  result: 'succeeded',
  succeeded: true,
  reasons: [],
  ...over,
});

const JUDGED = {
  state: 'judged',
  scale: 'number',
  score: 0.8,
  passed: true,
  marks: null,
  passShare: null,
  referenced: null,
  model: null,
  unjudged: null,
  claims: [],
  reason: null,
} as unknown as NonNullable<ReplayEntry['judge']>;

const compared = (
  title: string,
  over: Partial<EntryComparison> = {},
): EntryComparison => ({
  originalRunId: `run_${title}`,
  taskId: `task_${title}`,
  title,
  candidate: [entry({ runId: `run_${title}_candidate` })],
  baseline: [entry({ runId: `run_${title}_baseline` })],
  candidateSuccess: 1,
  baselineSuccess: 1,
  costDelta: 0.1,
  msDelta: null,
  stepsDelta: null,
  scoreDelta: null,
  scoreUncompared: null,
  regressed: false,
  pair: null,
  ...over,
});

const detail = (comparison: EntryComparison[]): ReplayDetail =>
  ({
    id: 'replay_1',
    ceiling: { amount: 5, currency: 'USD' },
    comparison,
  }) as unknown as ReplayDetail;

const renderComparison = (
  comparison: EntryComparison[],
  picked: string | null = null,
  onPick: (id: string) => void = () => {},
) =>
  render(
    <ReplayComparison
      replay={detail(comparison)}
      picked={picked}
      onPick={onPick}
    />,
  );

const tasks = () =>
  within(
    screen.getByRole('list', { name: 'Each task, regressions first' }),
  ).getAllByRole('listitem');

const sides = (row: HTMLElement) =>
  [...row.querySelectorAll('[data-slot="entry-side"]')] as HTMLElement[];

describe('ReplayComparison', () => {
  it('lists the tasks that regressed first, marking them, and keeps the reasons for a hover', () => {
    renderComparison([
      compared('Steady'),
      compared('Worse', {
        regressed: true,
        candidate: [
          entry({
            result: 'failed',
            succeeded: false,
            reasons: [
              {
                code: 'check-failed',
                detail: 'npm test',
                steps: [],
                hunks: [],
              },
            ],
          }),
        ],
      }),
    ]);

    const [worse, steady] = tasks();
    expect(
      within(worse as HTMLElement).getByRole('button', {
        name: 'Details of Worse',
      }),
    ).toBeInTheDocument();
    expect(
      within(worse as HTMLElement).getByLabelText('Regressed'),
    ).toBeInTheDocument();
    expect(
      within(steady as HTMLElement).queryByLabelText('Regressed'),
    ).not.toBeInTheDocument();

    const [failed] = sides(worse as HTMLElement);
    expect(failed).toHaveTextContent('Failed');
    expect(failed).toHaveAccessibleDescription('Checks failed: npm test');
  });

  it('opens a task’s details when its row is picked, and shows which is open', async () => {
    const onPick = vi.fn();
    renderComparison(
      [compared('Steady'), compared('Other')],
      'run_Other',
      onPick,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Details of Steady' }),
    );

    expect(onPick).toHaveBeenCalledWith('run_Steady');
    expect(
      screen.getByRole('button', { name: 'Details of Other' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('says which change the blind judge found closer to the accepted one, task by task', () => {
    renderComparison([
      compared('Won', { pair: 'win' }),
      compared('Lost', { pair: 'loss' }),
      compared('Tied', { pair: 'tie' }),
      compared('Unpaired'),
    ]);

    expect(
      [...document.querySelectorAll('[data-slot="pair"]')].map(
        (each) => each.textContent,
      ),
    ).toEqual(['This one', 'The baseline', 'Neither', '–']);
  });

  it('leaves out the side-by-side column where no task was compared so', () => {
    renderComparison([compared('Steady')]);

    expect(document.querySelector('[data-slot="pair"]')).toBeNull();
  });

  it('says why two judge scores could not be compared', () => {
    renderComparison([
      compared('Steady', {
        scoreUncompared: 'other-rubric',
        candidate: [entry({ judge: JUDGED })],
      }),
    ]);

    expect(screen.getByText('Judged by different rubrics')).toBeInTheDocument();
  });

  it('tells how many copies of a task succeeded, each copy on hover', () => {
    renderComparison([
      compared('Twice', {
        candidate: [
          entry({ repeat: 1, runId: 'run_copy_1' }),
          entry({
            repeat: 2,
            runId: 'run_copy_2',
            result: 'failed',
            succeeded: false,
          }),
          entry({
            repeat: 3,
            runId: 'run_copy_3',
            result: 'pending',
            succeeded: null,
          }),
        ],
        candidateSuccess: 0.5,
      }),
    ]);

    const [copies] = sides(tasks()[0] as HTMLElement);
    expect(copies).toHaveTextContent('1 of 2 succeeded');
    expect(copies).toHaveAccessibleDescription(
      'Copy 1: Succeeded · Copy 2: Failed · Copy 3: Pending',
    );
  });

  it('averages the cost of a task’s copies where nothing was compared', () => {
    renderComparison([
      compared('Alone', {
        baseline: [],
        costDelta: null,
        candidate: [
          entry({ repeat: 1, cost: { amount: 0.5, currency: 'USD' } }),
          entry({ repeat: 2, cost: { amount: 1.5, currency: 'USD' } }),
        ],
      }),
    ]);

    expect(screen.getByText('$1.00')).toBeInTheDocument();
  });

  it('shows each task’s own result and cost, and no baseline, where nothing was compared', () => {
    renderComparison([compared('Alone', { baseline: [], costDelta: null })]);

    expect(sides(tasks()[0] as HTMLElement)).toHaveLength(1);
    expect(screen.queryByText('Not replayed')).not.toBeInTheDocument();
    expect(screen.getByText('$0.50')).toBeInTheDocument();
  });
});
