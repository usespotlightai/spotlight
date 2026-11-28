import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JudgeDisagreementItem } from '@/components/features/inbox/disagreements/JudgeDisagreementItem';
import type { JudgeDisagreement } from '@/lib/judge-disagreement';
import { SettledPartContext } from '@/lib/settled-part';
import {
  failedDisagreementOf,
  passedDisagreementOf,
} from '@/test/fixtures/judge-disagreement';
import { runScoresOf } from '@/test/fixtures/run-scores';

const scores = vi.fn<(...args: unknown[]) => unknown>();
const mutate = vi.fn();
const mutateClaim = vi.fn();
const sending = vi.fn<() => { isPending: boolean; error: unknown }>();
const sent = vi.fn<() => boolean>();

vi.mock('@/hooks/api/useRunScores', () => ({
  useRunScores: () => ({
    data: scores(),
    isPending: scores() === undefined,
    errorUpdateCount: 0,
    isFetching: false,
  }),
}));

vi.mock('@/hooks/api/useAnswerJudgeDisagreement', () => ({
  useAnswerJudgeDisagreement: () => ({
    mutate,
    isPending: sending().isPending,
    isError: sending().error !== null,
    error: sending().error,
  }),
}));

vi.mock('@/hooks/api/useAnswerDisagreementClaim', () => ({
  useAnswerDisagreementClaim: () => ({
    mutate: (input: unknown, options?: { onSuccess?: () => void }) => {
      mutateClaim(input);
      if (sent()) {
        options?.onSuccess?.();
      }
    },
    isPending: sending().isPending,
    isError: sending().error !== null,
    error: sending().error,
  }),
}));

vi.mock('@/hooks/useMe', () => ({
  useMe: () => ({ id: 'user_sam', name: 'Sam Rivera', image: null }),
}));

vi.mock('@/hooks/api/useMembers', () => ({
  useMembers: () => ({
    data: [
      { id: 'user_sam', name: 'Sam Rivera', image: null },
      { id: 'user_priya', name: 'Priya Raman', image: null },
    ],
  }),
}));

const ANSWERED_AT = '2026-11-14T10:00:00.000Z';

const showing = (disagreement: JudgeDisagreement) =>
  render(
    <MemoryRouter>
      <JudgeDisagreementItem
        slug="acme"
        teamId="team_1"
        disagreement={disagreement}
      />
    </MemoryRouter>,
  );

const cards = () =>
  screen.getAllByRole('region', { name: /^Disagreement on claim / });

const card = (claim: number) =>
  screen.getByRole('region', { name: `Disagreement on claim ${claim}` });

const expectTitles = (expected: readonly string[]) => {
  expect(cards()).toHaveLength(expected.length);
  cards().forEach((each, at) => {
    expect(
      within(each).getByRole('heading', { name: expected[at] }),
    ).toBeInTheDocument();
  });
};

const fact = () => document.querySelector('[data-slot="disagreement-fact"]');

const send = (claim: number) =>
  within(card(claim)).getByRole('button', { name: 'Send answer' });

const pick = (claim: number, choice: string) =>
  userEvent.click(within(card(claim)).getByRole('radio', { name: choice }));

const why = (claim: number) =>
  within(card(claim)).getByRole('textbox', { name: 'Why' });

const answered = (
  claim: number,
  answer: 'judge-right' | 'claim-wrong',
  answeredBy = 'user_sam',
  note: string | null = null,
) => ({ claim, answer, note, answeredBy, answeredAt: ANSWERED_AT });

beforeEach(() => {
  scores.mockReturnValue(runScoresOf('run_1', 'task_1'));
  sending.mockReturnValue({ isPending: false, error: null });
  sent.mockReturnValue(false);
  mutate.mockClear();
  mutateClaim.mockClear();
});

describe('JudgeDisagreementItem', () => {
  it('shows the sentence once, then one card per claim in dispute, each waiting for your answer with its own trace icon', () => {
    showing(failedDisagreementOf());

    expect(fact()).toHaveTextContent(
      'You accepted this run. The judge failed it. Your answer helps Spotlight rewrite the claims.',
    );
    expect(
      document.querySelectorAll('[data-slot="disagreement-fact"]'),
    ).toHaveLength(1);
    expect(
      screen.getByRole('list', { name: 'Claims in dispute' }),
    ).toBeInTheDocument();
    expectTitles(['Waiting for your answer', 'Waiting for your answer']);
    for (const each of cards()) {
      expect(
        within(each).getByRole('link', { name: 'Open the trace' }),
      ).toHaveAttribute('href', expect.stringContaining('task_1'));
    }
  });

  it('says you held the run as wrong that the judge passed', () => {
    showing(passedDisagreementOf({ labelFrom: 'held-as-wrong' }));

    expect(fact()).toHaveTextContent(
      'You held this run as wrong. The judge passed it.',
    );
  });

  it('puts the claims in dispute in claim order, each with its reasons and what they cite', () => {
    showing(failedDisagreementOf());

    expect(cards()).toHaveLength(2);
    expect(card(1)).toHaveTextContent('1. Retries stop on a 410 Gone');
    expect(card(3)).toHaveTextContent('3. The queue is drained');
    expect(
      screen.queryByText('Other failures go to the retry queue.'),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: 'retry.ts:1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'read step' }),
    ).toBeInTheDocument();
  });

  it('sends the answer and the note of one card for its own claim only', async () => {
    showing(failedDisagreementOf());

    expect(why(3)).toHaveAttribute(
      'placeholder',
      'Tell Spotlight why (optional)',
    );
    expect(send(3)).toBeDisabled();
    expect(send(3)).toHaveAccessibleDescription('Pick an answer to send');
    await pick(3, 'The claim does not fit this run');
    await userEvent.type(why(3), '  A drain that asks is fine.  ');
    await userEvent.click(send(3));

    expect(mutateClaim).toHaveBeenCalledExactlyOnceWith({
      slug: 'acme',
      teamId: 'team_1',
      disagreementId: 'disagreement_1',
      claim: 2,
      answer: { answer: 'claim-wrong', note: 'A drain that asks is fine.' },
    });
    expect(send(1)).toBeDisabled();
    expect(send(1)).toHaveAccessibleDescription('Pick an answer to send');
  });

  it('keeps the other card’s draft when one card sends', async () => {
    showing(failedDisagreementOf());

    await pick(1, 'The judge is right');
    await userEvent.type(why(1), 'The 410 retry is the bug.');
    await pick(3, 'The judge is right');
    await userEvent.click(send(3));

    expect(
      within(card(1)).getByRole('radio', { name: 'The judge is right' }),
    ).toBeChecked();
    expect(why(1)).toHaveValue('The 410 retry is the bug.');
    expect(send(1)).toBeEnabled();
  });

  it('moves focus to the sent card', async () => {
    sent.mockReturnValue(true);
    showing(failedDisagreementOf());

    await pick(3, 'The judge is right');
    await userEvent.click(send(3));

    expect(card(3)).toHaveFocus();
    expect(card(3)).toHaveAttribute('tabindex', '-1');
  });

  it('sends no note when the note is only spaces', async () => {
    showing(failedDisagreementOf());

    await pick(1, 'The judge is right');
    await userEvent.type(why(1), '   ');
    await userEvent.click(send(1));

    expect(mutateClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        claim: 0,
        answer: { answer: 'judge-right', note: null },
      }),
    );
  });

  it('keeps the draft and Send answer after a failed send, with no inline error', async () => {
    sending.mockReturnValue({
      isPending: false,
      error: {
        status: 409,
        detail:
          'Claim 1 of judge disagreement disagreement_1 already has an answer.',
      },
    });
    showing(failedDisagreementOf());
    await pick(1, 'The judge is right');
    await userEvent.click(send(1));
    await userEvent.click(send(1));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(send(1)).toBeEnabled();
    expect(mutateClaim).toHaveBeenCalledTimes(2);
  });

  it('says what its resolved inbox item left unanswered, and still takes an answer', () => {
    render(
      <MemoryRouter>
        <SettledPartContext value>
          <JudgeDisagreementItem
            slug="acme"
            teamId="team_1"
            disagreement={failedDisagreementOf({
              answers: [answered(0, 'judge-right', 'user_sam')],
            })}
          />
        </SettledPartContext>
      </MemoryRouter>,
    );

    expectTitles(['Answered by you', 'Not answered']);
    expect(
      within(cards()[1] ?? document.body).getByRole('button', {
        name: 'Send answer',
      }),
    ).toBeInTheDocument();
  });

  it('titles each card by its own state, and shows a sent card read-only where it was', () => {
    showing(
      failedDisagreementOf({
        answers: [
          answered(0, 'judge-right', 'user_sam', 'The 410 retry is the bug.'),
        ],
      }),
    );

    expectTitles(['Answered by you', 'Waiting for your answer']);
    expect(card(1)).toHaveTextContent('Nov 14');
    expect(
      within(card(1)).getByText('Answer', { selector: 'dt' })
        .nextElementSibling,
    ).toHaveTextContent('The judge is right');
    expect(
      within(card(1)).getByText('Why', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('The 410 retry is the bug.');
    expect(within(card(1)).queryByRole('radio')).toBeNull();
    expect(within(card(3)).getAllByRole('radio')).toHaveLength(2);
    expect(fact()).toHaveTextContent(
      'Your answer helps Spotlight rewrite the claims.',
    );
  });

  it('names each answerer on a team item, and drops why it asks once nothing waits for you', () => {
    showing(
      failedDisagreementOf({
        askedOf: null,
        labelFrom: 'merged',
        state: 'answered',
        answers: [
          answered(0, 'judge-right'),
          answered(
            2,
            'claim-wrong',
            'user_priya',
            'The spec allows a flaky check.',
          ),
        ],
      }),
    );

    expectTitles(['Answered by you', 'Answered by Priya Raman']);
    expect(fact()).toHaveTextContent(
      /^The pull request was merged\. The judge failed the run\.$/,
    );
    expect(within(card(1)).queryByText('Why', { selector: 'dt' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send answer' })).toBeNull();
  });

  it('withdraws every card, keeping the rows of a claim answered before', () => {
    showing(
      failedDisagreementOf({
        state: 'withdrawn',
        answers: [answered(0, 'judge-right')],
        withdrawnAt: '2026-11-14T12:00:00.000Z',
        withdrawnBecause: 'claims-changed',
      }),
    );

    expectTitles(['Withdrawn', 'Withdrawn']);
    expect(fact()).toHaveTextContent(
      'You accepted this run. The judge failed it. The station’s judge changed after this run.',
    );
    expect(
      within(card(1)).getByText('Answer', { selector: 'dt' }),
    ).toBeInTheDocument();
    expect(
      within(card(3)).queryByText('Answer', { selector: 'dt' }),
    ).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send answer' })).toBeNull();
  });

  it.each([
    ['label-gone', 'People’s verdict on this run is gone.'],
    ['verdicts-agree', 'The judge and people agree on this run now.'],
  ] as const)(
    'says why Spotlight withdrew a merged run’s question: %s',
    (withdrawnBecause, why) => {
      showing(
        failedDisagreementOf({
          labelFrom: 'merged',
          askedOf: null,
          state: 'withdrawn',
          withdrawnAt: '2026-11-14T12:00:00.000Z',
          withdrawnBecause,
        }),
      );

      expect(fact()).toHaveTextContent(
        `The pull request was merged. The judge failed the run. ${why}`,
      );
      expect(screen.queryByRole('button', { name: 'Send answer' })).toBeNull();
    },
  );

  it('shows the judge’s mark on each claim in dispute', () => {
    showing(failedDisagreementOf());

    for (const each of cards()) {
      expect(
        within(each)
          .getByText('Judge', { selector: 'dt' })
          .nextElementSibling?.querySelector('[data-slot="claim-mark"]'),
      ).toHaveTextContent('Not met');
    }
  });

  it('says the pull request was merged, and offers to send each card’s answer', () => {
    showing(failedDisagreementOf({ askedOf: null, labelFrom: 'merged' }));

    expect(fact()).toHaveTextContent(
      /^The pull request was merged\. The judge failed the run\. Your answer helps Spotlight rewrite the claims\.$/,
    );
    expect(send(1)).toBeInTheDocument();
    expect(send(3)).toBeInTheDocument();
  });

  it('shows every card while the run’s verdicts load, with lines in place of the reasons', () => {
    scores.mockReturnValue(undefined);
    showing(failedDisagreementOf());

    expect(cards()).toHaveLength(2);
    for (const each of cards()) {
      expect(each.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
      expect(
        within(each)
          .getByText('Judge', { selector: 'dt' })
          .nextElementSibling?.querySelectorAll('[data-slot="skeleton"]'),
      ).toHaveLength(2);
      expect(within(each).getAllByRole('radio')).toHaveLength(2);
    }
  });

  describe('where no claim is in dispute', () => {
    const pickerSend = () =>
      screen.getByRole('button', { name: 'Send answer' });

    it('asks which claim the run did not meet, on one card', async () => {
      showing(passedDisagreementOf());

      expect(
        screen.getByRole('region', { name: 'Disagreement with the judge' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('list', { name: 'Claims in dispute' }),
      ).toBeNull();
      expect(fact()).toHaveTextContent(
        'You sent this run back. The judge passed it. Your answer helps Spotlight rewrite the claims.',
      );
      expect(pickerSend()).toBeDisabled();
      expect(pickerSend()).toHaveAccessibleDescription('Pick a claim to send');

      const options = within(
        screen.getByRole('radiogroup', { name: 'Claim not met' }),
      ).getAllByRole('radio');
      expect(options).toHaveLength(4);
      expect(options[3]).toHaveAccessibleName('No claim covers it');

      await userEvent.click(options[1]);
      await userEvent.type(
        screen.getByRole('textbox', { name: 'What was wrong' }),
        'It retried jobs that can never succeed.',
      );
      await userEvent.click(pickerSend());

      expect(mutate).toHaveBeenCalledWith({
        slug: 'acme',
        teamId: 'team_1',
        disagreementId: 'disagreement_1',
        answer: {
          note: 'It retried jobs that can never succeed.',
          shouldHaveFailed: 1,
        },
      });
    });

    it('needs a note when no claim covers what was wrong', async () => {
      showing(passedDisagreementOf());

      await userEvent.click(
        screen.getByRole('radio', { name: 'No claim covers it' }),
      );
      const note = screen.getByRole('textbox', { name: 'What was wrong' });
      expect(note).toHaveAttribute(
        'placeholder',
        'Tell Spotlight what the run did wrong',
      );
      expect(note).toBeRequired();
      expect(pickerSend()).toHaveAccessibleDescription(
        'Say what the run did wrong to send',
      );

      await userEvent.type(note, 'It never ran the tests.');
      await userEvent.click(pickerSend());

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          answer: { note: 'It never ran the tests.', shouldHaveFailed: null },
        }),
      );
    });

    it('shows the claim an answered pass names, or that no claim covers it', () => {
      showing(
        passedDisagreementOf({
          state: 'answered',
          notMet: {
            claim: null,
            note: 'It retried jobs that can never succeed.',
            answeredBy: 'user_sam',
            answeredAt: ANSWERED_AT,
          },
        }),
      );

      expect(
        screen.getByRole('heading', { name: 'Answered by you' }),
      ).toBeInTheDocument();
      expect(
        document.querySelector('[data-slot="not-met-answer"]'),
      ).toHaveTextContent('No claim covers it');
      expect(
        screen.getByText('It retried jobs that can never succeed.'),
      ).toBeInTheDocument();
    });

    it('lists the claims of a withdrawn question, read-only', () => {
      showing(
        passedDisagreementOf({
          state: 'withdrawn',
          withdrawnAt: '2026-11-14T12:00:00.000Z',
          withdrawnBecause: 'claims-changed',
        }),
      );

      expect(
        screen.getByText('Claims', { selector: 'dt' }).nextElementSibling,
      ).toHaveTextContent(
        '1. Retries stop on a 410 Gone2. Every other failure is retried later3. The queue is drained',
      );
      expect(screen.queryByRole('radio')).toBeNull();
    });

    it('shows the answer and the reason of a question withdrawn after an answer', () => {
      showing(
        passedDisagreementOf({
          state: 'withdrawn',
          notMet: {
            claim: 1,
            note: 'It retried jobs that can never succeed.',
            answeredBy: 'user_sam',
            answeredAt: ANSWERED_AT,
          },
          withdrawnAt: '2026-11-14T12:00:00.000Z',
          withdrawnBecause: 'claims-changed',
        }),
      );

      expect(
        document.querySelector('[data-slot="not-met-answer"]'),
      ).toHaveTextContent('2. Every other failure is retried later');
      expect(fact()).toHaveTextContent(
        'The station’s judge changed after this run.',
      );
      expect(screen.queryByRole('button', { name: 'Send answer' })).toBeNull();
    });
  });
});
