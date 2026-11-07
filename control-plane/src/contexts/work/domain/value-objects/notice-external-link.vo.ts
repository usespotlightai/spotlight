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

  static allows(raw: string): boolean {
    const url = parsed(raw);

    return (
      raw.length <= MAX_LENGTH &&
      url !== null &&
      url.origin === ORIGIN &&
      url.pathname.length >= 2 &&
      url.username === '' &&
      url.password === ''
    );
  }

  static of(input: { url: string; label: string }): NoticeExternalLink {
    const label = input.label.trim();

    if (!NoticeExternalLink.allows(input.url)) {
      throw new InvalidNoticeExternalLinkError(
        `must be a ${ORIGIN}/ address, at most ${MAX_LENGTH} characters`,
      );
    }
    if (!label || label.length > MAX_LABEL) {
      throw new InvalidNoticeExternalLinkError(
        `label must be 1 to ${MAX_LABEL} characters`,
      );
    }

    return new NoticeExternalLink(new URL(input.url).href, label);
  }

  equals(other: NoticeExternalLink): boolean {
    return this.url === other.url && this.label === other.label;
  }
}
