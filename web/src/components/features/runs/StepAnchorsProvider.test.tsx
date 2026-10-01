import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StepsDisclosure } from '@/components/features/inbox/conversation/StepsDisclosure';
import { StepAnchorsProvider } from '@/components/features/runs/StepAnchorsProvider';
import type { JournalStep, RunJournal } from '@/lib/inbox';
import { useStepAnchors } from '@/lib/step-anchors';

const stepOf = (text: string, detail: string | null = null): JournalStep => ({
  kind: 'tool',
  status: 'completed',
  tool: 'execute',
  detail,
  ms: 0,
  startedAt: '2026-09-30T10:00:00.000Z',
  locations: [],
  given: null,
  returned: null,
  change: null,
  text,
});

const journalOf = (attempt: number, steps: JournalStep[]): RunJournal => ({
  runId: 'run_1',
  attempt,
  ms: null,
  spans: [],
  marks: {
    startedAt: null,
    readyAt: null,
    spokeFrom: null,
    spokeTo: null,
    endedAt: null,
  },
  spent: null,
  steps,
});

const FIRST = [stepOf('npm ci')];
const SECOND = [stepOf('npm test', '12 passing')];
const JOURNALS = [journalOf(1, FIRST), journalOf(2, SECOND)];

function Focusing({ index }: { index: number }) {
  const { focus } = useStepAnchors();

  return (
    <button type="button" onClick={() => focus(index)}>
      Go to step {index}
    </button>
  );
}

describe('StepAnchorsProvider', () => {
  it('names each step by its place across the run’s attempts, and opens the one asked for', async () => {
    render(
      <StepAnchorsProvider runId="run_1" journals={JOURNALS}>
        <Focusing index={1} />
        <StepsDisclosure label="Worked" steps={SECOND} />
      </StepAnchorsProvider>,
    );

    expect(screen.getByRole('button', { name: 'Worked' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Go to step 1' }));

    expect(screen.getByRole('button', { name: 'Worked' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const step = document.getElementById('step-run_1-1');
    expect(step).toHaveAttribute('data-focused', 'true');
    expect(step?.querySelector('[aria-expanded]')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
