import { InvalidNoticeError } from '@work/domain/exceptions/invalid-notice.error';

const MOST_LENGTH = 300;

const MOST_LABEL = 60;

const SEGMENT = /^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;

export class NoticeLink {
  private constructor(
    readonly path: string,
    readonly label: string,
  ) {}

  static of(input: { path: string; label: string }): NoticeLink {
    const segments = input.path.split('/');
    const label = input.label.trim();

    if (
      input.path.length > MOST_LENGTH ||
      segments.some((each) => !SEGMENT.test(each))
    ) {
      throw new InvalidNoticeError(
        `link must be a relative path within its team, at most ${MOST_LENGTH} characters`,
      );
    }
    if (!label || label.length > MOST_LABEL) {
      throw new InvalidNoticeError(
        `link label must be 1 to ${MOST_LABEL} characters`,
      );
    }

    return new NoticeLink(input.path, label);
  }
}
