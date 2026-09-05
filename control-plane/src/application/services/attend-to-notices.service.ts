import type { LoggerPort } from '@application/ports/logger.port';
import type { Noticed } from '@application/ports/webhook-source.port';
import type { ReadConfiguration } from '@application/services/read-configuration.service';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { Repository } from '@domain/value-objects/repository.vo';

/**
 * What a delivery said about a team rather than about a task: a repository it
 * reads configuration from has moved, or the host it reached them through is
 * gone.
 *
 * Nothing here fails a delivery. A host is not told to send its push again
 * because a file in it would not parse.
 */
export class AttendToNotices {
  constructor(
    private readonly teams: TeamRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly reading: ReadConfiguration,
    private readonly logger: LoggerPort,
  ) {}

  async attend(noticed: readonly Noticed[]): Promise<void> {
    for (const notice of noticed) {
      try {
        if (notice.kind === 'configuration-touched') {
          await this.readFor(notice.repository);
        }

        if (notice.kind === 'connection-ended') {
          await this.letGoOf(notice.source, notice.externalId);
        }
      } catch (error) {
        this.logger.error(
          { err: error, notice: notice.kind },
          'Attending to what a delivery said about the workspace',
        );
      }
    }
  }

  /**
   * The connection dropped, so nothing goes on believing Spotlight can reach
   * a host it cannot. Found by what the host called it rather than by which
   * workspace: an installation removed is removed from whoever held it.
   */
  private async letGoOf(source: string, externalId: string): Promise<void> {
    const workspaceId = await this.workspaces.withConnection(
      source,
      externalId,
    );

    if (!workspaceId) {
      return;
    }

    const workspace = await this.workspaces.find(workspaceId);

    if (workspace) {
      await this.workspaces.save(workspace.disconnectedFrom(source));
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
