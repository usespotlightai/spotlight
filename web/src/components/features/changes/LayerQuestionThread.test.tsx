import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LayerQuestionThread } from '@/components/features/changes/LayerQuestionThread';
import type { ChangeStack, LayerQuestion } from '@/lib/change-stack';
import type { CodeReview } from '@/lib/review';
import { ReviewContext } from '@/lib/review-context';
import { INVITATIONS } from '@/test/fixtures/change-stack';

const mutate = vi.fn();

vi.mock('@/hooks/api/useAnswerStackQuestion', () => ({
  useAnswerStackQuestion: () => ({
    isPending: false,
    isError: false,
    mutate,
  }),
}));
vi.mock('@/hooks/useMe', () => ({
  useMe: () => ({ id: 'user_1', name: 'Maya Chen', image: null }),
}));

const QUESTION: LayerQuestion = {
  id: 'c1.l2.q1',
  question: 'What happens when someone accepts an expired invitation?',
  hunks: ['h1', 'h2'],
  answered: null,
};

const shown = (question: LayerQuestion, onReveal = vi.fn()) =>
  render(
    <ReviewContext
      value={{
        teamId: 'team_1',
        runId: 'run_1',
        repository: null,
        review: { comments: [] } as unknown as CodeReview,
        threads: [],
        composing: null,
        composerAppears: false,
        compose: vi.fn(),
      }}
    >
      <LayerQuestionThread
        stack={INVITATIONS as ChangeStack}
        question={question}
        onReveal={onReveal}
      />
    </ReviewContext>,
  );

describe('LayerQuestionThread', () => {
  it('sends the answer in the reviewer’s words', async () => {
    shown(QUESTION);

    await userEvent.type(
      screen.getByRole('textbox', { name: `Answer “${QUESTION.question}”` }),
      'It is refused.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(mutate).toHaveBeenLastCalledWith({
      teamId: 'team_1',
      runId: 'run_1',
      stackId: INVITATIONS.id,
      questionId: 'c1.l2.q1',
      reply: 'It is refused.',
    });
  });

  it('lets the reviewer say they do not know, and shows no answer before that', async () => {
    shown(QUESTION);

    expect(screen.queryByText(/Expected answer/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'I don’t know' }));

    expect(mutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ reply: null }),
    );
  });

  it('shows the verdict, the feedback, the expected answer and where the code shows it', async () => {
    const onReveal = vi.fn();
    shown(
      {
        ...QUESTION,
        answered: {
          questionId: 'c1.l2.q1',
          reply: 'It adds the member.',
          verdict: 'missed',
          feedback: 'The accept endpoint refuses it with 410.',
          expected: 'It answers 410 and adds no member.',
          outdated: false,
        },
      },
      onReveal,
    );

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('It adds the member.')).toBeTruthy();
    expect(screen.getByText('Missed')).toBeTruthy();
    expect(
      screen.getByText('The accept endpoint refuses it with 410.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Expected answer: It answers 410 and adds no member.'),
    ).toBeTruthy();

    await userEvent.click(
      screen.getByRole('button', { name: 'invitation.controller.ts:1' }),
    );
    expect(onReveal).toHaveBeenCalledWith({
      path: 'control-plane/src/invitations/invitation.controller.ts',
      line: 1,
      layerId: 'c1.l2',
    });
  });

  it('asks again, with the earlier words, once the code changed after the answer', async () => {
    shown({
      ...QUESTION,
      answered: {
        questionId: 'c1.l2.q1',
        reply: 'It adds the member.',
        verdict: 'right',
        feedback: null,
        expected: null,
        outdated: true,
      },
    });

    expect(
      screen.getByText(
        'The code changed after you answered. Please answer again.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Expected answer/)).toBeNull();
    expect(screen.queryByText('Right')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(mutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ reply: 'It adds the member.' }),
    );
  });
});
