import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TraceView } from '@/components/trace/TraceView';
import type {
  JournalStepResponseDto,
  RunJournalResponseDto,
  TaskRunResponseDto,
} from '@/lib/api';

const AT = Date.UTC(2026, 7, 29, 12, 0, 0);
const iso = (ms: number) => new Date(AT + ms).toISOString();

const step = (
  part: Partial<JournalStepResponseDto> & { startedAt: string; ms: number },
): JournalStepResponseDto =>
  ({
    kind: 'tool',
    text: 'a tool',
    status: 'completed',
    tool: 'execute',
    detail: null,
    locations: [],
    given: null,
    returned: null,
    change: null,
    ...part,
  }) as JournalStepResponseDto;

const runs: TaskRunResponseDto[] = [
  {
    id: 'run_1',
    state: 'completed',
    attempt: 1,
    exitCode: 0,
    startedAt: iso(0),
    updatedAt: iso(60_000),
    harness: 'claude-code',
    station: {
      name: 'Implementation',
      color: '#edc12b',
      position: 1,
      count: 3,
    },
    review: null,
  } as TaskRunResponseDto,
];

const journals: RunJournalResponseDto[] = [
  {
    runId: 'run_1',
    attempt: 1,
    steps: [
      step({ kind: 'hook', text: 'prepare', startedAt: iso(1_000), ms: 8_000 }),
      step({
        text: 'npm test',
        status: 'failed',
        startedAt: iso(20_000),
        ms: 5_000,
        detail: 'sh: vitest: command not found',
        locations: [{ path: 'src/queue.ts', line: 12 }],
      }),
    ],
    spans: [
      {
        id: 's1',
        parentId: null,
        name: 'claude_code.llm_request',
        startedAt: iso(30_000),
        ms: 4_350,
        failed: false,
        attributes: [{ name: 'gen_ai.request.model', value: 'claude-opus-5' }],
      },
    ],
    ms: 38_000,
    marks: {
      startedAt: iso(0),
      readyAt: iso(10_000),
      spokeFrom: iso(12_000),
      spokeTo: iso(50_000),
      endedAt: iso(60_000),
    },
    spent: { used: 12_173, size: 200_000, cost: 0.066, currency: 'USD' },
    readable: true,
  } as RunJournalResponseDto,
];

const view = () => render(<TraceView runs={runs} journals={journals} />);

const rows = () => within(screen.getByRole('list')).getAllByRole('listitem');

describe('TraceView', () => {
  it('lays the run out as its phases and what happened in them', () => {
    view();

    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Implementation · claude-code'),
      expect.stringContaining('Prepare'),
      expect.stringContaining('prepare'),
      expect.stringContaining('Turn'),
      expect.stringContaining('npm test'),
      expect.stringContaining('llm_request'),
      expect.stringContaining('Publish'),
    ]);
  });

  it('says what the whole thing cost before any of it is read', () => {
    view();

    expect(screen.getByText('Faults').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Took').nextSibling).toHaveTextContent('1m');
  });

  // A failed command is the thing a reader is looking for, so it is the thing
  // that should not need looking for.
  it('marks what failed', () => {
    view();

    expect(screen.getByRole('button', { name: 'npm test' })).toHaveClass(
      'text-destructive',
    );
  });

  it('shows what a step reached and what came back when it is picked', async () => {
    const user = userEvent.setup();
    view();

    await user.click(screen.getByRole('button', { name: 'npm test' }));

    expect(screen.getByText('src/queue.ts:12')).toBeInTheDocument();
    expect(
      screen.getByText('sh: vitest: command not found'),
    ).toBeInTheDocument();
  });

  // The one thing the protocol could never say.
  it('shows which model answered, where the harness said so', async () => {
    const user = userEvent.setup();
    view();

    await user.click(screen.getByRole('button', { name: 'llm_request' }));

    expect(screen.getByText('gen_ai.request.model')).toBeInTheDocument();
    expect(screen.getByText('claude-opus-5')).toBeInTheDocument();
  });

  it('folds a row away and says how much it is holding', async () => {
    const user = userEvent.setup();
    view();

    await user.click(screen.getByRole('button', { name: 'Fold Turn' }));

    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Implementation · claude-code'),
      expect.stringContaining('Prepare'),
      expect.stringContaining('prepare'),
      expect.stringContaining('Turn'),
      expect.stringContaining('Publish'),
    ]);
  });

  it('keeps only what was searched for, and what it hangs from', async () => {
    const user = userEvent.setup();
    view();

    await user.type(screen.getByRole('searchbox'), 'npm');

    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Implementation · claude-code'),
      expect.stringContaining('Turn'),
      expect.stringContaining('npm test'),
    ]);
  });

  it('says so when a task has had nothing run against it', () => {
    render(<TraceView runs={[]} journals={[]} />);

    expect(
      screen.getByText('Nothing has worked this task yet.'),
    ).toBeInTheDocument();
  });
});
