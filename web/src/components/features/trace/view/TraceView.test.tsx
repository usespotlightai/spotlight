import {
  render,
  screen,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TraceView } from '@/components/features/trace/view/TraceView';
import type { JournalStepResponseDto, TraceNodeResponseDto } from '@/lib/api';
import type { Trace } from '@/lib/trace';
import { runScoresOf } from '@/stories/fixtures/run-scores';

const scores = vi.fn();

vi.mock('@/hooks/api/useRunScores', () => ({
  useRunScores: (_teamId: string, runId: string) => ({
    data: scores(runId),
    isPending: false,
    isFetching: false,
    errorUpdateCount: 0,
  }),
}));

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
                  { name: 'gen_ai.request.temperature', value: '0.7' },
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

const view = () => {
  scores.mockImplementation((runId: string) => runScoresOf(runId, 'task_1'));
  return render(<TraceView trace={trace()} teamId="team_1" />);
};

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

  it('says what a run cost on the row that ran it', () => {
    view();

    expect(rows()[0]).toHaveTextContent('$0.07');
  });

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

    expect(
      screen.getByText('sh: vitest: command not found'),
    ).toBeInTheDocument();
  });

  it('shows which model answered, where the harness said so', async () => {
    const user = userEvent.setup();
    view();

    await user.click(screen.getByRole('button', { name: 'llm_request' }));

    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('claude-opus-5')).toBeInTheDocument();
    expect(screen.queryByText('gen_ai.request.model')).not.toBeInTheDocument();
  });

  it('lists the rest of what a harness reported about itself', async () => {
    const user = userEvent.setup();
    view();

    await user.click(screen.getByRole('button', { name: 'llm_request' }));

    expect(screen.getByText('gen_ai.request.temperature')).toBeInTheDocument();
    expect(screen.getByText('"0.7"')).toBeInTheDocument();
  });

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
    expect(
      screen.getByText('sh: vitest: command not found'),
    ).toBeInTheDocument();

    await user.click(document.body);

    await waitForElementToBeRemoved(() =>
      screen.queryByText('sh: vitest: command not found'),
    );
  });

  it('marks the judge’s verdict on the row of the run it judged', () => {
    view();

    expect(rows()[0]).toHaveTextContent('Judged');
    expect(rows()[0]).toHaveTextContent('No');
  });

  it('says why the judge decided so when the run is picked', async () => {
    view();

    await userEvent.click(
      screen.getByRole('button', { name: 'Implementation' }),
    );

    expect(
      within(screen.getByRole('list', { name: 'Why' })).getByText(
        'The change retries a 410 Gone like any other failure.',
      ),
    ).toBeVisible();
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
});
