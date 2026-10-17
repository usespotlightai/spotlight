import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunConfigDto } from '@work/application/dto/run-config.dto';
import type {
  RanConfig,
  RunConfigSummary,
  RunReaderPort,
} from '@work/application/ports/run-reader.port';
import type { ReadRunConfigQuery } from '@work/application/queries/read-run-config.query';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';

const configOf = (run: RanConfig): StationConfig =>
  StationConfig.rehydrate(run.parts, run.fingerprint);

export class ReadRunConfigHandler
  implements QueryHandlerPort<ReadRunConfigQuery, RunConfigDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly runs: RunReaderPort,
  ) {}

  async execute(query: ReadRunConfigQuery): Promise<RunConfigDto | null> {
    try {
      const found = await this.runs.configFor(
        RunId.of(query.runId),
        UserId.of(query.viewerId),
      );

      if (!found || !(await this.readsAsTeam(found.ranForTeam, query))) {
        return null;
      }

      if (!found.ran) {
        return { fingerprint: null, config: null, changedSince: null };
      }

      const ran = configOf(found.ran);
      const before = found.before ? configOf(found.before) : null;

      return {
        fingerprint: ran.fingerprint,
        config: ran.parts,
        changedSince:
          found.before && before && !before.sameAs(ran)
            ? {
                runId: found.before.runId,
                taskId: found.before.taskId,
                fingerprint: before.fingerprint,
                changes: ran.changesFrom(before),
              }
            : null,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async readsAsTeam(
    ranForTeam: RunConfigSummary['ranForTeam'],
    query: ReadRunConfigQuery,
  ): Promise<boolean> {
    if (!ranForTeam) {
      return true;
    }

    const reader = await this.access.permissionsAsTeamReader(
      query.teamId,
      PersonPrincipal.of(UserId.of(query.viewerId)),
    );

    return (
      reader !== null &&
      reader.workspaceId.value === ranForTeam.workspaceId &&
      reader.teamId.value === ranForTeam.teamId
    );
  }
}
