import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RunChanges } from '@/components/features/runs/RunChanges';
import type { JournalStep, RunJournal } from '@/lib/inbox';
import { WithRunSidePanel } from '@/test/WithRunSidePanel';

const step = (part: Partial<JournalStep>): JournalStep =>
  ({
    kind: 'tool',
    text: 'edit',
    status: 'completed',
    tool: 'edit',
    detail: null,
    ms: 1,
    startedAt: '2026-08-29T12:00:00.000Z',
    locations: [],
    input: null,
    output: null,
    change: null,
    ...part,
  }) as JournalStep;

const journal = (steps: JournalStep[]): RunJournal =>
  ({
    runId: 'r1',
    attempt: 1,
    steps,
    ms: null,
    spent: null,
    spans: [],
    marks: {
      startedAt: null,
      readyAt: null,
      firstAgentUpdateAt: null,
      lastAgentUpdateAt: null,
      agentStoppedAt: null,
      endedAt: null,
    },
  }) as RunJournal;

describe('RunChanges', () => {
  it('shows nothing when the run touched no files', () => {
    const { container } = render(<RunChanges journals={[journal([])]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('boxes the files changed and opens a diff in the side panel', async () => {
    render(
      <WithRunSidePanel>
        <RunChanges
          journals={[
            journal([
              step({
                change: { path: 'a.ts', before: 'a\n', after: 'a\nb\n' },
              }),
              step({ change: { path: 'b.ts', before: 'x\n', after: 'y\n' } }),
            ]),
          ]}
        />
      </WithRunSidePanel>,
    );

    expect(screen.getByText(/2 files changed/)).toBeInTheDocument();

    const file = screen.getByRole('button', { name: /a\.ts/ });
    expect(file).toHaveAttribute('aria-pressed', 'false');

    expect(
      screen.queryByRole('button', { name: 'Close diff' }),
    ).not.toBeInTheDocument();

    await userEvent.click(file);

    expect(file).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Close diff' }),
    ).toBeInTheDocument();
  });
});
