import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { InboxWork } from '@/components/features/inbox/conversation/InboxWork';
import { JudgeReasonItem } from '@/components/features/runs/judge/JudgeReasonItem';
import { RunCitationTargets } from '@/components/features/runs/RunCitationTargets';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { StepAnchorsProvider } from '@/components/features/runs/StepAnchorsProvider';
import type { JournalStep, RunJournal } from '@/lib/inbox';
import type { JudgeReason } from '@/lib/judge';
import { useRunSidePanel } from '@/lib/run-side-panel';

const stepOf = (
  text: string,
  change: JournalStep['change'] = null,
): JournalStep => ({
  kind: 'tool',
  status: 'completed',
  tool: change ? 'edit' : 'execute',
  detail: null,
  ms: 0,
  startedAt: '2026-09-30T10:00:00.000Z',
  locations: [],
  input: null,
  output: null,
  change,
  text,
});

const journalOf = (runId: string, steps: JournalStep[]): RunJournal => ({
  runId,
  attempt: 1,
  firstStep: 0,
  activity: null,
  background: [],
  ms: null,
  spans: [],
  marks: {
    startedAt: null,
    readyAt: null,
    firstAgentUpdateAt: null,
    lastAgentUpdateAt: null,
    agentStoppedAt: null,
    endedAt: null,
  },
  spent: null,
  steps,
});

const RETRY = {
  path: '/workspace/worker/services/retry.ts',
  before: 'a\nb\nc\n',
  after: 'a\nB\nc\nd\n',
};

const JOURNALS = [
  journalOf('run_1', [
    stepOf('npm ci'),
    stepOf('Edited retry.ts', RETRY),
    stepOf('npm test'),
  ]),
  journalOf('run_0', [
    stepOf('Edited queue.ts', {
      path: '/workspace/worker/queue.ts',
      before: 'a\n',
      after: 'b\n',
    }),
  ]),
];

const citing = (path: string, step: number): JudgeReason => ({
  claim: 0,
  text: 'It retries a 410 Gone.',
  citations: [
    {
      kind: 'step',
      step: { index: step, kind: 'tool', tool: 'execute', text: 'npm test' },
      hunk: null,
    },
    {
      kind: 'hunk',
      step: null,
      hunk: { id: `${path}#1`, path, header: '@@ -2,1 +2,3 @@', lines: [] },
    },
  ],
});

function Pane() {
  const { selected, lines } = useRunSidePanel();

  return (
    <output aria-label="Side pane">
      {selected ? `${selected.path} ${lines?.start}-${lines?.end}` : 'closed'}
    </output>
  );
}

const showing = (reason: JudgeReason) =>
  render(
    <RunSidePanel>
      <StepAnchorsProvider runId="run_1" journals={JOURNALS}>
        <RunCitationTargets runId="run_1" journals={JOURNALS}>
          <InboxWork
            journals={JOURNALS.filter((each) => each.runId === 'run_1')}
          />
          <ul>
            <JudgeReasonItem reason={reason} />
          </ul>
          <Pane />
        </RunCitationTargets>
      </StepAnchorsProvider>
    </RunSidePanel>,
  );

describe('RunCitationTargets', () => {
  it('opens the run’s steps at the cited step, and marks it', async () => {
    showing(citing('worker/services/retry.ts', 2));

    await userEvent.click(screen.getByRole('button', { name: 'execute step' }));

    expect(screen.getByRole('button', { name: /^Worked/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(document.getElementById('step-run_1-2')).toHaveAttribute(
      'data-focused',
      'true',
    );
  });

  it('opens the cited file in the side pane with the lines of its hunk, and marks its row', async () => {
    showing(citing('worker/services/retry.ts', 2));

    await userEvent.click(screen.getByRole('button', { name: 'retry.ts:2' }));

    expect(screen.getByRole('status', { name: 'Side pane' })).toHaveTextContent(
      '/workspace/worker/services/retry.ts 2-4',
    );
    await userEvent.click(screen.getByRole('button', { name: /^Worked/ }));
    expect(
      screen.getByRole('button', { name: /^retry\.ts\s*\+/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('greys out a step past the run’s journal and a file of another run', () => {
    showing(citing('worker/queue.ts', 3));

    expect(
      screen.getByRole('button', { name: 'execute step' }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByRole('button', { name: 'queue.ts:2' }),
    ).toHaveAccessibleDescription(
      'The file is no longer in the run’s changes.',
    );
  });
});
