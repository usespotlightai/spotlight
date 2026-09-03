import type { LoggerPort } from '@application/ports/logger.port';
import type { Noticed } from '@application/ports/webhook-source.port';
import type { ReadConfiguration } from '@application/services/read-configuration.service';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceFinding } from '@domain/repositories/workspace.repository';
import { Repository } from '@domain/value-objects/repository.vo';

/**
 * What a delivery said about a workspace rather than about a task.
 *
 * There is one such thing today: a repository Spotlight reads configuration
 * from has moved, and so what it should be listening to may have changed.
 * Read again, and only for the workspace whose repository it was.
 *
 * Nothing here fails a delivery. A host is not to be told to send its push
 * again because a file in it would not parse: the problems are written down
 * where the workspace can see them, and the delivery is done with.
 */
export class AttendToNotices {
  constructor(
    private readonly teams: TeamRepository,
    private readonly workspaces: WorkspaceFinding,
    private readonly reading: ReadConfiguration,
    private readonly logger: LoggerPort,
  ) {}

  async attend(noticed: readonly Noticed[]): Promise<void> {
    for (const notice of noticed) {
      if (notice.kind !== 'configuration-touched') {
        continue;
      }

      try {
        await this.readFor(notice.repository);
      } catch (error) {
        this.logger.error(
          { err: error, repository: notice.repository },
          'Reading configuration after a push',
        );
      }
    }
  }

  private async readFor(named: string): Promise<void> {
    const repository = Repository.of(named);

    // Whoever reads this repository reads it because it is theirs to read:
    // a push tells us a repository moved, not whose configuration it holds.
    for (const team of await this.teams.readingFrom(repository)) {
      const workspace = await this.workspaces.find(team.workspaceId);

      if (workspace) {
        await this.reading.read(workspace, team);
      }
    }
  }
}
