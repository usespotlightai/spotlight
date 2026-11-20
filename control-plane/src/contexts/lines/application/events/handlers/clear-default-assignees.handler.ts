import type { MemberLookupPort } from '@identity/application/ports/member-lookup.port';
import type { Line } from '@lines/domain/aggregates/line.aggregate';
import type { LineRepository } from '@lines/domain/repositories/line.repository';
import { TaskCounts } from '@lines/domain/value-objects/stranded-station';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CLEAR_DEFAULT_ASSIGNEES = 'lines.clear-default-assignees';

export class ClearDefaultAssignees {
  constructor(
    private readonly lines: LineRepository,
    private readonly directory: MemberLookupPort,
    private readonly logger: LoggerPort,
  ) {}

  async clearOf(workspaceId: WorkspaceId, userId: UserId): Promise<void> {
    try {
      const emails = await this.directory.emailsOf(userId);

      for (const line of await this.lines.withDefaultAssignee(
        workspaceId,
        emails,
      )) {
        if (line.source === null) {
          await this.lines.save(this.cleared(line));
        }
      }
    } catch (error) {
      this.logger.warn(
        { err: error, workspaceId: workspaceId.value, userId: userId.value },
        'Could not clear the default assignee of a member without access',
      );
      throw error;
    }
  }

  private cleared(line: Line): Line {
    return line.update(
      {
        key: line.key,
        name: line.name,
        stations: line.stations,
        reactions: line.reactions,
        role: line.role,
        repositories: line.repositories.entries,
        reviews: line.reviews,
        placement: line.placement,
        warmSandboxes: line.warmSandboxes,
        defaultAssignee: null,
        replayCheck: line.replayCheck,
        search: line.search,
        source: line.source,
      },
      TaskCounts.NONE,
      ChangeActor.spotlight(line.workspaceId),
    );
  }
}
