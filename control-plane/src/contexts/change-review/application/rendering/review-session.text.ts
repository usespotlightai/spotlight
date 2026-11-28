import { nonEmpty } from '@shared-kernel/domain/non-empty';

/** What a change review session shows on the Runners page, and whether it opens the task run it is for. */
interface ChangeReviewSessionTitle {
  readonly title: string;
  readonly opens: boolean;
}

const stackOf = (task: string | null): string =>
  nonEmpty(task) ? `the change stack for “${task}”` : 'a change stack';

export const ChangeReviewSessionTitles = {
  drafting(task: string | null, redraft: boolean): ChangeReviewSessionTitle {
    return {
      title: `${redraft ? 'Rebuilding' : 'Building'} ${stackOf(task)}`,
      opens: true,
    };
  },

  grading(task: string | null): ChangeReviewSessionTitle {
    return { title: `Checking an answer about ${stackOf(task)}`, opens: true };
  },
};
