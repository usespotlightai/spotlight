import type { NoticeFormName } from '@work/application/ports/notices.port';

export const TEAM_NOTICES = Symbol('TEAM_NOTICES');

export interface TeamNoticeDto {
  readonly id: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly form: NoticeFormName;
  readonly headline: string;
  readonly points: readonly string[];
  readonly externalLink: {
    readonly url: string;
    readonly label: string;
  } | null;
}

export interface TeamNoticesPort {
  notify(notice: TeamNoticeDto): Promise<void>;
}
