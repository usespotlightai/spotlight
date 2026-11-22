import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { LayerQuestionThread } from '@/components/features/changes/LayerQuestionThread';
import type { LayerQuestion, QuestionAnswer } from '@/lib/change-stack';
import { StackTeamContext } from '@/lib/review-context';
import { INVITATIONS } from '@/test/fixtures/change-stack';

const QUESTION: LayerQuestion = {
  id: 'c1.l2.q1',
  question: 'What happens when someone accepts an expired invitation?',
  hunks: ['h1', 'h2'],
  answered: null,
};

const ANSWER: QuestionAnswer = {
  questionId: 'c1.l2.q1',
  reply: 'It adds the member.',
  grading: 'pending',
  verdict: null,
  feedback: null,
  expected: 'It answers 410 and adds no member.',
  outdated: false,
};

const onTeam: Decorator = (Story) => (
  <QueryClientProvider client={new QueryClient()}>
    <StackTeamContext value="team_1">
      <div className="max-w-md p-4">
        <Story />
      </div>
    </StackTeamContext>
  </QueryClientProvider>
);

const meta = {
  title: 'Team/Runs/Change stack/Question',
  component: LayerQuestionThread,
  args: { stack: INVITATIONS, question: QUESTION, onReveal: () => {} },
  decorators: [onTeam],
} satisfies Meta<typeof LayerQuestionThread>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unanswered: Story = {};

export const Grading: Story = {
  args: { question: { ...QUESTION, answered: ANSWER } },
};

export const Graded: Story = {
  args: {
    question: {
      ...QUESTION,
      answered: {
        ...ANSWER,
        grading: 'graded',
        verdict: 'missed',
        feedback: 'The accept endpoint refuses it with 410.',
      },
    },
  },
};

export const NotGraded: Story = {
  name: 'Not graded',
  args: {
    question: { ...QUESTION, answered: { ...ANSWER, grading: 'failed' } },
  },
};
