import { InvalidNoticeError } from '@work/domain/exceptions/invalid-notice.error';

const MAX_SUBJECT = 200;

export class NoticeSubject {
  private constructor(readonly value: string) {}

  static of(raw: string): NoticeSubject {
    const subject = raw.trim();

    if (!subject || subject.length > MAX_SUBJECT) {
      throw new InvalidNoticeError(
        `subject must be 1 to ${MAX_SUBJECT} characters`,
      );
    }

    return new NoticeSubject(subject);
  }

  equals(other: NoticeSubject): boolean {
    return this.value === other.value;
  }
}
