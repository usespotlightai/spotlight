import type {
  UpkeepNotice,
  UpkeepNoticesPort,
} from '@memory/application/ports/upkeep-notices.port';
import type { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { NoticesPort } from '@work/application/ports/notices.port';

const OPENS_UPKEEP = 'Review the changes';

const subjectOf = (upkeepId: MemoryUpkeepId): string =>
  `memory-upkeep ${upkeepId.value}`;

const counted = (count: number, one: string, many: string): string[] =>
  count === 0 ? [] : [`${count} ${count === 1 ? one : many}`];

export class UpkeepNotices implements UpkeepNoticesPort {
  constructor(private readonly notices: NoticesPort) {}

  swept(notice: UpkeepNotice): Promise<void> {
    return this.notices.create({
      workspaceId: notice.workspaceId,
      teamId: notice.teamId,
      addressee: null,
      form: 'advice',
      subject: subjectOf(notice.upkeepId),
      link: `memory/upkeep/${notice.upkeepId.value}`,
      linkLabel: OPENS_UPKEEP,
      externalLink: null,
      headline: 'Some of what the team remembers may be out of date',
      points: [
        ...counted(notice.retiring, 'memory to retire', 'memories to retire'),
        ...counted(
          notice.merging,
          'set of memories to merge',
          'sets of memories to merge',
        ),
      ],
    });
  }

  settled(upkeepId: MemoryUpkeepId, teamId: TeamId): Promise<void> {
    return this.notices.resolve({
      teamId,
      form: 'advice',
      subject: subjectOf(upkeepId),
    });
  }
}
