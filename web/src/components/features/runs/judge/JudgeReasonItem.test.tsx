import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { JudgeReasonItem } from '@/components/features/runs/judge/JudgeReasonItem';
import {
  type CitationTargets,
  CitationTargetsContext,
} from '@/lib/citation-targets';
import type { CitedHunk, JudgeReason } from '@/lib/judge';

const HUNK: CitedHunk = {
  id: 'worker/services/retry.ts#1',
  path: 'worker/services/retry.ts',
  header: '@@ -1,3 +1,4 @@',
  lines: [' export const retry = async (job: Job) => {'],
};

const REASON: JudgeReason = {
  claim: 0,
  text: 'The change retries a 410 Gone like any other failure.',
  citations: [
    {
      kind: 'step',
      step: { index: 2, kind: 'tool', tool: 'read', text: 'retry.ts' },
      hunk: null,
    },
    { kind: 'hunk', step: null, hunk: HUNK },
  ],
};

const showing = (targets: CitationTargets, reason: JudgeReason = REASON) =>
  render(
    <CitationTargetsContext value={targets}>
      <ul>
        <JudgeReasonItem reason={reason} />
      </ul>
    </CitationTargetsContext>,
  );

const link = (name: string) => screen.getByRole('button', { name });

describe('JudgeReasonItem', () => {
  it('goes to the cited step and the cited file where the page shows them, and opens no copy', async () => {
    const step = vi.fn();
    const hunk = vi.fn();
    const steps = vi.fn((_index: number) => step);
    const hunks = vi.fn((_hunk: CitedHunk) => hunk);
    showing({ step: steps, hunk: hunks });

    await userEvent.click(link('step 2'));
    await userEvent.click(link('retry.ts:1'));

    expect(steps).toHaveBeenCalledWith(2);
    expect(hunks).toHaveBeenCalledWith(HUNK);
    expect(step).toHaveBeenCalledOnce();
    expect(hunk).toHaveBeenCalledOnce();
    expect(link('retry.ts:1')).toHaveAttribute(
      'title',
      'worker/services/retry.ts',
    );
    expect(
      document.querySelector(
        '[data-slot="cited-step"], [data-slot="cited-hunk"]',
      ),
    ).toBeNull();
    expect(link('step 2')).not.toHaveAttribute('aria-disabled');
  });

  it('greys out a step the page does not show, and says why', async () => {
    const hunk = vi.fn();
    showing({ step: () => null, hunk: () => hunk });

    expect(link('step 2')).toHaveAttribute('aria-disabled', 'true');
    expect(link('step 2')).toHaveAccessibleDescription(
      'The step is no longer in the run’s journal.',
    );
    await userEvent.click(link('step 2'));
    await userEvent.click(link('retry.ts:1'));
    expect(hunk).toHaveBeenCalledOnce();
  });

  it('greys out a file the run no longer changes, and says why', () => {
    showing({ step: () => vi.fn(), hunk: () => null });

    expect(link('retry.ts:1')).toHaveAttribute('aria-disabled', 'true');
    expect(link('retry.ts:1')).toHaveAccessibleDescription(
      'The file is no longer in the run’s changes.',
    );
    expect(link('retry.ts:1')).not.toHaveAttribute('title');
    expect(link('step 2')).not.toHaveAttribute('aria-disabled');
  });

  it('greys out a step whose text the journal no longer has, without asking the page for it', () => {
    const steps = vi.fn(() => vi.fn());
    showing(
      { step: steps, hunk: () => null },
      {
        ...REASON,
        citations: [
          {
            kind: 'step',
            step: { index: 4, kind: null, tool: null, text: null },
            hunk: null,
          },
        ],
      },
    );

    expect(link('step 4')).toHaveAccessibleDescription(
      'The step is no longer in the run’s journal.',
    );
    expect(steps).not.toHaveBeenCalled();
  });

  it('greys out every link where nothing on the page can show them', () => {
    render(
      <ul>
        <JudgeReasonItem reason={REASON} />
      </ul>,
    );

    expect(link('step 2')).toHaveAttribute('aria-disabled', 'true');
    expect(link('retry.ts:1')).toHaveAttribute('aria-disabled', 'true');
  });
});
