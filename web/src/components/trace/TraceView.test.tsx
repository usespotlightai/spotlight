import {
  render,
  screen,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TraceView } from '@/components/trace/TraceView';
import type { JournalStepResponseDto, TraceNodeResponseDto } from '@/lib/api';
import type { Trace } from '@/lib/trace';

const AT = Date.UTC(2026, 7, 29, 12, 0, 0);
const iso = (ms: number) => new Date(AT + ms).toISOString();

const step = (
  part: Partial<JournalStepResponseDto> & { text: string; startedAt: string },
): JournalStepResponseDto => ({
  kind: 'tool',
  status: 'completed',
  tool: 'execute',
  detail: null,
  ms: 1_000,
  locations: [],
  given: null,
  returned: null,
  change: null,
  ...part,
});

const node = (
  part: Partial<TraceNodeResponseDto> & { id: string; name: string },
): TraceNodeResponseDto => ({
  kind: 'step',
  startedAt: iso(0),
  ms: 1_000,
  tone: 'agent',
  cost: null,
  currency: null,
  step: null,
  span: null,
  children: [],
  ...part,
});

/** One run, as the control plane assembles it: phases holding what happened. */
const trace = (): Trace => ({
  startedAt: iso(0),
  ms: 60_000,
  rows: 8,
  faults: 1,
  roots: [
    node({
      id: 'run:run_1',
      name: 'Implementation',
      kind: 'run',
      ms: 60_000,
      cost: 0.066,
      currency: 'USD',
      children: [
        node({
          id: 'run_1:prepare',
          name: 'Prepare',
          kind: 'phase',
          tone: 'overhead',
          ms: 10_000,
          children: [
            node({
              id: 'run_1:step:0',
              name: 'prepare',
              tone: 'overhead',
              startedAt: iso(1_000),
              ms: 8_000,
              step: step({
                kind: 'hook',
                text: 'prepare',
                startedAt: iso(1_000),
                ms: 8_000,
              }),
            }),
          ],
        }),
        node({
          id: 'run_1:turn',
          name: 'Turn · claude-code',
          kind: 'phase',
          startedAt: iso(12_000),
          ms: 38_000,
          children: [
            node({
              id: 'run_1:step:1',
              name: 'npm test',
              tone: 'failed',
              startedAt: iso(20_000),
              ms: 5_000,
              step: step({
                text: 'npm test',
                status: 'failed',
                startedAt: iso(20_000),
                ms: 5_000,
                detail: 'sh: vitest: command not found',
                locations: [{ path: 'src/queue.ts', line: 12 }],
              }),
            }),
            node({
              id: 'span:s1',
              name: 'llm_request',
              kind: 'span',
              startedAt: iso(30_000),
              ms: 4_350,
              span: {
                id: 's1',
                parentId: null,
                name: 'claude_code.llm_request',
                startedAt: iso(30_000),
                ms: 4_350,
                failed: false,
                attributes: [
                  { name: 'gen_ai.request.model', value: 'claude-opus-5' },
                ],
              },
            }),
            node({
              id: 'run_1:step:2',
              name: 'Said',
              startedAt: iso(35_000),
              ms: 400,
              step: step({
                kind: 'said',
                text: 'vitest is missing from the image',
                startedAt: iso(35_000),
                ms: 400,
              }),
            }),
          ],
        }),
        node({
          id: 'run_1:publish',
          name: 'Publish',
          kind: 'phase',
          tone: 'overhead',
          startedAt: iso(50_000),
          ms: 10_000,
        }),
      ],
    }),
  ],
});

const view = () => render(<TraceView trace={trace()} />);

const rows = () => within(screen.getByRole('list')).getAllByRole('listitem');

describe('TraceView', () => {
  it('lays the run out as its phases and what happened in them', () => {
    view();

    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Implementation'),
      expect.stringContaining('Prepare'),
      expect.stringContaining('prepare'),
      expect.stringContaining('Turn · claude-code'),
      expect.stringContaining('npm test'),
      expect.stringContaining('llm_request'),
      expect.stringContaining('Said'),
      expect.stringContaining('Publish'),
    ]);
  });

  // The protocol accounts per run, so the run's own row is where it belongs.
  it('says what a run cost on the row that ran it', () => {
    view();

    expect(rows()[0]).toHaveTextContent('$0.07');
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

  // A row named for its kind has its words nowhere but the panel.
  it('shows what was said, where the row only says that it spoke', async () => {
    const user = userEvent.setup();
    view();

    await user.click(screen.getByRole('button', { name: 'Said' }));

    expect(
      screen.getByText('vitest is missing from the image'),
    ).toBeInTheDocument();
  });

  it('puts a picked row down again when the click lands away from it', async () => {
    const user = userEvent.setup();
    view();

    await user.click(screen.getByRole('button', { name: 'npm test' }));
    expect(screen.getByText('src/queue.ts:12')).toBeInTheDocument();

    await user.click(screen.getByRole('searchbox'));

    // It is kept for as long as it takes to be seen leaving.
    await waitForElementToBeRemoved(() =>
      screen.queryByText('src/queue.ts:12'),
    );
  });

  it('folds a row away', async () => {
    const user = userEvent.setup();
    view();

    await user.click(
      screen.getByRole('button', { name: 'Fold Turn · claude-code' }),
    );

    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Implementation'),
      expect.stringContaining('Prepare'),
      expect.stringContaining('prepare'),
      expect.stringContaining('Turn · claude-code'),
      expect.stringContaining('Publish'),
    ]);
  });

  it('keeps only what was searched for, and what it hangs from', async () => {
    const user = userEvent.setup();
    view();

    await user.type(screen.getByRole('searchbox'), 'npm');

    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Implementation'),
      expect.stringContaining('Turn · claude-code'),
      expect.stringContaining('npm test'),
    ]);
  });

  it('says so when a task has had nothing run against it', () => {
    render(
      <TraceView
        trace={{ startedAt: null, ms: 0, rows: 0, faults: 0, roots: [] }}
      />,
    );

    expect(
      screen.getByText('Nothing has worked this task yet.'),
    ).toBeInTheDocument();
  });
});
