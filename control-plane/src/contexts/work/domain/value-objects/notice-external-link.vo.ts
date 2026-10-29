import { InvalidNoticeExternalLinkError } from '@work/domain/exceptions/invalid-notice-external-link.error';

const MAX_LENGTH = 500;

const MAX_LABEL = 60;

const ORIGIN = 'https://github.com';

const parsed = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

export class NoticeExternalLink {
  private constructor(
    readonly url: string,
    readonly label: string,
  ) {}

  static of(input: { url: string; label: string }): NoticeExternalLink {
    const url = parsed(input.url);
    const label = input.label.trim();

    if (
      input.url.length > MAX_LENGTH ||
      !url ||
      url.origin !== ORIGIN ||
      url.pathname.length < 2 ||
      url.username !== '' ||
      url.password !== ''
    ) {
      throw new InvalidNoticeExternalLinkError(
        `must be a ${ORIGIN}/ address, at most ${MAX_LENGTH} characters`,
      );
    }
    if (!label || label.length > MAX_LABEL) {
      throw new InvalidNoticeExternalLinkError(
        `label must be 1 to ${MAX_LABEL} characters`,
      );
    }

    return new NoticeExternalLink(url.href, label);
  }
}
