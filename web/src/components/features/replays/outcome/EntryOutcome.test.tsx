import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryOutcome } from '@/components/features/replays/outcome/EntryOutcome';
import type {
  ChangeStackResponseDto,
  ReplayEntryResponseDto,
  RunJournalResponseDto,
} from '@/lib/api';

const stacks = vi.fn();

vi.mock('@/hooks/api/useReplayRun', () => ({
  useReplayRun: () => ({ data: { journals: JOURNALS } }),
}));
vi.mock('@/hooks/api/useRunChangeStacks', () => ({
  useRunChangeStacks: () => ({ data: { stacks: stacks() } }),
}));

const step = (
  over: Partial<RunJournalResponseDto['steps'][number]>,
): RunJournalResponseDto['steps'][number] => ({
  kind: 'tool',
  status: 'completed',
  tool: 'execute',
  text: 'npm test',
  detail: null,
  ms: 1_000,
  startedAt: '2026-10-03T10:00:00.000Z',
  locations: [],
  given: null,
  returned: null,
  change: null,
  ...over,
});

const JOURNALS = [
  {
    runId: 'run_1',
    attempt: 1,
    ms: 60_000,
    spans: [],
    marks: {
      startedAt: null,
      readyAt: null,
      spokeFrom: null,
      spokeTo: null,
      endedAt: null,
    },
    spent: null,
    steps: [
      step({ kind: 'thought', tool: null, text: 'Look at the retries.' }),
      step({
        tool: 'edit',
        text: 'services/retry.ts',
        change: {
          path: '/workspace/worker/services/retry.ts',
          before: 'a\n',
          after: 'a\nb\n',
        },
      }),
    ],
  },
] as unknown as RunJournalResponseDto[];

const ENTRY = {
  runId: 'run_1',
  result: 'failed',
  reasons: [
    { code: 'check-failed', detail: 'npm test', steps: [], hunks: [] },
    {
      code: 'judge-failed',
      detail: 'It retries a 410 Gone like any other failure.',
      steps: [1],
      hunks: ['h1'],
    },
  ],
} as unknown as ReplayEntryResponseDto;

const STACK = {
  id: 'stack_1',
  files: [
    {
      path: 'services/retry.ts',
      hunks: [{ id: 'h1', newStart: 1, newLines: 2 }],
    },
  ],
  check: {
    command: 'npm test',
    state: 'checked',
    reason: null,
    whole: {
      step: 'whole',
      passed: false,
      output: 'FAIL retry > gives up on a 410',
      tookMs: 41_000,
    },
    layers: [],
  },
} as unknown as ChangeStackResponseDto;

const showing = (entry: ReplayEntryResponseDto = ENTRY) =>
  render(<EntryOutcome teamId="team_1" entry={entry} />);

beforeEach(() => {
  stacks.mockReturnValue([STACK]);
});

describe('EntryOutcome', () => {
  it('lists every reason the replay was scored as it was', () => {
    showing();

    const why = within(screen.getByRole('region', { name: 'Why it failed' }));
    expect(why.getByText(/npm test/)).toBeVisible();
    expect(
      why.getByText(/It retries a 410 Gone like any other failure\./),
    ).toBeVisible();
  });

  it('opens the lines the judge cited in place, and goes back', async () => {
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'retry.ts, lines 1–2' }),
    );

    expect(screen.getByText('worker/services/retry.ts')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Why it failed' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('region', { name: 'Why it failed' })).toBeVisible();
  });

  it('shows the step the judge cited in place', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Step 1' }));

    expect(screen.getByText('Step 1 · edit')).toBeVisible();
  });

  it('shows what the failed check printed', () => {
    showing();

    const checks = within(screen.getByRole('region', { name: 'Checks' }));
    expect(checks.getByText('The whole change')).toBeVisible();
    expect(
      checks.getByText(/FAIL retry > gives up on a 410/),
    ).toBeInTheDocument();
  });

  it('shows what the replay changed', () => {
    showing();

    expect(
      within(screen.getByRole('region', { name: 'What it changed' })).getByText(
        '1 file changed',
      ),
    ).toBeVisible();
  });

  it('says nothing about why while the replay is still being scored', () => {
    showing({ ...ENTRY, result: 'pending' });

    expect(screen.queryByRole('region', { name: /^Why/ })).toBeNull();
  });
});
