import type {
  RunnerEgressPort,
  SharedEgressFor,
} from '@runners/application/ports/runner-egress.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { CheckActiveRunsCommand } from '@work/application/commands/egress.commands';
import type { EgressActiveRunsDto } from '@work/application/dto/egress-admission.dto';
import type { EgressRedemptions } from '@work/application/services/egress-redemptions.service';

export const MAX_RUNS_AT_ONCE = 500;

export class CheckActiveRunsHandler
  implements CommandHandlerPort<CheckActiveRunsCommand, EgressActiveRunsDto>
{
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly redemptions: EgressRedemptions,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: CheckActiveRunsCommand): Promise<EgressActiveRunsDto> {
    try {
      const shared = await this.egress.sharedWith(command.token);

      if (!shared) {
        return { outcome: 'refused' };
      }

      if (command.proxyCredentials.length > MAX_RUNS_AT_ONCE) {
        return { outcome: 'too-many', max: MAX_RUNS_AT_ONCE };
      }

      const active: string[] = [];

      for (const credential of new Set(command.proxyCredentials)) {
        const admitted = await this.egress.admitThrough(
          shared,
          credential,
          this.clock.now(),
        );

        if (admitted && (await this.isStillActive(admitted))) {
          active.push(credential);
        }
      }

      return { outcome: 'checked', active };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async isStillActive(admitted: SharedEgressFor): Promise<boolean> {
    if (admitted.work?.kind !== 'run') {
      return true;
    }

    return (
      (await this.redemptions.leasedBy(
        RunId.of(admitted.work.id),
        RunnerId.of(admitted.runnerId),
        admitted.workspaceId,
      )) !== null
    );
  }
}
