import type { NotifyTeam } from '@integrations/application/services/notify-team.service';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  TeamNoticeDto,
  TeamNoticesPort,
} from '@work/application/ports/team-notices.port';

export class TeamNotices implements TeamNoticesPort {
  constructor(private readonly notices: NotifyTeam) {}

  notify(notice: TeamNoticeDto): Promise<void> {
    return this.notices.notify({
      id: notice.id,
      workspaceId: WorkspaceId.of(notice.workspaceId),
      teamId: TeamId.of(notice.teamId),
      form: notice.form,
      headline: notice.headline,
      points: notice.points,
      externalLink: notice.externalLink,
    });
  }
}
