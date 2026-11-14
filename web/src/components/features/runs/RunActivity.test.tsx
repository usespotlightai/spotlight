import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RunActivity } from '@/components/features/runs/RunActivity';
import type { JournalStep, RunJournal } from '@/lib/inbox';
import type { ShownProgress } from '@/lib/run';

const step = (part: Partial<JournalStep>): JournalStep => ({
  kind: 'tool',
  text: '',
  status: 'completed',
  tool: 'execute',
  detail: 'npm test',
  ms: 1,
  startedAt: '2026-11-09T12:00:00.000Z',
  locations: [],
  input: null,
  output: null,
  change: null,
  ...part,
});

const journal = (steps: JournalStep[]): RunJournal => ({
  runId: 'run_1',
  attempt: 1,
  activity: null,
  background: [],
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
});

const station = {
  name: 'Implementation',
  color: 'blue',
  position: 1,
  count: 3,
};

const renderActivity = (progress: ShownProgress | null) =>
  render(
    <RunActivity
      runId="run_1"
      journals={[
        journal([
          step({}),
          step({}),
          step({ kind: 'message', text: 'Next, the tests.' }),
          step({}),
        ]),
      ]}
      progress={progress}
      station={station}
    />,
  );

describe('RunActivity', () => {
  it('says the last stretch is working while the run works, and the earlier ones worked', () => {
    renderActivity('in-progress');

    expect(
      screen.getByRole('button', { name: 'Worked · 2 steps' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Working · 1 step' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Next, the tests.')).toBeInTheDocument();
  });

  it('says every stretch worked once the run is done', () => {
    renderActivity(null);

    expect(
      screen
        .getAllByRole('button', { name: /^Worked/ })
        .map((each) => each.textContent),
    ).toEqual(['Worked · 2 steps', 'Worked · 1 step']);
  });
});
