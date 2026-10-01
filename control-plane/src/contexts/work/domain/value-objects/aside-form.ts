import { InvalidTaskAsideError } from '@work/domain/exceptions/invalid-task-aside.error';

export const ASIDE_FORMS = ['memories', 'grade', 'alert'] as const;

export type AsideForm = (typeof ASIDE_FORMS)[number];

export const asideForm = (raw: string): AsideForm => {
  const form = ASIDE_FORMS.find((each) => each === raw);

  if (!form) {
    throw new InvalidTaskAsideError(
      `is one of ${ASIDE_FORMS.join(', ')}, not ${raw}`,
    );
  }

  return form;
};
