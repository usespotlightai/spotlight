import type {
  RunnerEgressPort,
  SharedEgressAuthentication,
} from '@runners/application/ports/runner-egress.port';
import type { EgressActiveRunsDto } from '@runs/application/dto/egress-authorization.dto';
import type { ActiveRunsQuery } from '@runs/application/queries/egress.queries';
import type { EgressSecretFetches } from '@runs/application/services/egress-secret-fetches.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const MAX_RUNS_AT_ONCE = 500;

export class ActiveRunsHandler
  implements QueryHandlerPort<ActiveRunsQuery, EgressActiveRunsDto>
{
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly fetches: EgressSecretFetches,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: ActiveRunsQuery): Promise<EgressActiveRunsDto> {
    try {
      const shared = await this.egress.sharedWith(query.token);

      if (!shared) {
        return { outcome: 'unauthorized' };
      }

      if (query.proxyCredentials.length > MAX_RUNS_AT_ONCE) {
        return { outcome: 'too-many', max: MAX_RUNS_AT_ONCE };
      }

      const active: string[] = [];

      for (const credential of new Set(query.proxyCredentials)) {
        const authorized = await this.egress.authorizeRunner(
          shared,
          credential,
          this.clock.now(),
        );

        if (authorized && (await this.isStillActive(authorized))) {
          active.push(credential);
        }
      }

      return { outcome: 'checked', active };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async isStillActive(
    authorized: SharedEgressAuthentication,
  ): Promise<boolean> {
    if (authorized.work?.kind !== 'run') {
      return true;
    }

    return (
      (await this.fetches.leasedBy(
        RunId.of(authorized.work.id),
        RunnerId.of(authorized.runnerId),
        authorized.workspaceId,
      )) !== null
    );
  }
}
