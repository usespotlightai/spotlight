import { InvalidNoticeError } from '@work/domain/exceptions/invalid-notice.error';

export const NOTICE_FORMS = ['ended', 'advice'] as const;

export type NoticeForm = (typeof NOTICE_FORMS)[number];

export const noticeForm = (raw: string): NoticeForm => {
  const form = NOTICE_FORMS.find((each) => each === raw);

  if (!form) {
    throw new InvalidNoticeError(
      `is one of ${NOTICE_FORMS.join(', ')}, not ${raw}`,
    );
  }

  return form;
};
