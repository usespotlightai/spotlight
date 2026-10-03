import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EntryJudgeClaims } from '@/components/features/replays/run/EntryJudgeClaims';
import type { ReplayEntry } from '@/lib/replay';

const JUDGE: NonNullable<ReplayEntry['judge']> = {
  state: 'judged',
  scale: 'claims',
  score: 0.5,
  passed: false,
  marks: [true, false],
  passShare: 1,
  referenced: true,
  model: 'm',
  unjudged: null,
  claims: ['Retries stop on a 410 Gone', 'The queue is drained'],
  reasons: [
    {
      text: 'Three jobs are still queued.',
      claim: 1,
      citations: [
        {
          kind: 'step',
          step: { index: 2, kind: null, tool: null, text: null },
          hunk: null,
        },
      ],
    },
  ],
};

describe('EntryJudgeClaims', () => {
  it('names each claim in its own words, marked in words, with the judge’s reasons under it', () => {
    render(<EntryJudgeClaims judge={JUDGE} marks={[true, false]} files={[]} />);

    expect(
      [...document.querySelectorAll('[data-slot="claim-verdict"]')].map(
        (each) => each.querySelector('p')?.textContent,
      ),
    ).toEqual(['MetRetries stop on a 410 Gone', 'Not metThe queue is drained']);
    expect(
      screen
        .getByRole('list', { name: 'Why, on The queue is drained' })
        .querySelector('[data-slot="judge-reason"]'),
    ).toHaveTextContent('Three jobs are still queued.');
    expect(
      screen.getByText('A run passes when it meets every claim.'),
    ).toBeInTheDocument();
  });
});
