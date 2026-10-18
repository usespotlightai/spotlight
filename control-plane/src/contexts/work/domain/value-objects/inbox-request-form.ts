import { InvalidInboxRequestError } from '@work/domain/exceptions/invalid-inbox-request.error';

export const INBOX_REQUEST_FORMS = ['memories', 'grade', 'alert'] as const;

export type InboxRequestForm = (typeof INBOX_REQUEST_FORMS)[number];

export const inboxRequestForm = (raw: string): InboxRequestForm => {
  const form = INBOX_REQUEST_FORMS.find((each) => each === raw);

  if (!form) {
    throw new InvalidInboxRequestError(
      `form must be one of ${INBOX_REQUEST_FORMS.join(', ')}, not ${raw}`,
    );
  }

  return form;
};
