import { InvalidNoticeError } from '@work/domain/exceptions/invalid-notice.error';

const MAX_LENGTH = 300;

const MAX_LABEL = 60;

const SEGMENT = /^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;

// A link leads within the team of its notice, or, for a notice about the whole workspace, within the workspace.
export const NOTICE_LINK_SCOPES = ['team', 'workspace'] as const;

export type NoticeLinkScope = (typeof NOTICE_LINK_SCOPES)[number];

export class NoticeLink {
  private constructor(
    readonly path: string,
    readonly label: string,
    readonly scope: NoticeLinkScope,
  ) {}

  static of(input: {
    path: string;
    label: string;
    scope?: NoticeLinkScope;
  }): NoticeLink {
    const segments = input.path.split('/');
    const label = input.label.trim();

    if (
      input.path.length > MAX_LENGTH ||
      segments.some((each) => !SEGMENT.test(each))
    ) {
      throw new InvalidNoticeError(
        `link must be a relative path within its team or workspace, at most ${MAX_LENGTH} characters`,
      );
    }
    if (!label || label.length > MAX_LABEL) {
      throw new InvalidNoticeError(
        `link label must be 1 to ${MAX_LABEL} characters`,
      );
    }

    return new NoticeLink(input.path, label, input.scope ?? 'team');
  }

  equals(other: NoticeLink): boolean {
    return (
      this.path === other.path &&
      this.label === other.label &&
      this.scope === other.scope
    );
  }
}
