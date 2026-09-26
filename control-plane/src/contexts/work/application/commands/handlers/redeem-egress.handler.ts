import type { RunnerEgressPort } from '@runners/application/ports/runner-egress.port';
import type { RunGrantsPort } from '@secrets/application/ports/run-grants.port';
import type { RunRedemptionsPort } from '@secrets/application/ports/run-redemptions.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RedeemEgressCommand } from '@work/application/commands/egress.commands';
import type { EgressRedemptionDto } from '@work/application/dto/egress-redemption.dto';
import type { SandboxReachPort } from '@work/application/ports/sandbox-reach.port';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class RedeemEgressHandler
  implements CommandHandlerPort<RedeemEgressCommand, EgressRedemptionDto>
{
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly runs: RunRepository,
    private readonly redemptions: RunRedemptionsPort,
    private readonly grants: RunGrantsPort,
    private readonly reach: SandboxReachPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RedeemEgressCommand): Promise<EgressRedemptionDto> {
    try {
      const admitted = await this.egress.admit(command.token, this.clock.now());

      if (!admitted) {
        return { outcome: 'refused' };
      }

      const nothingWorn = {
        outcome: 'redeemed' as const,
        runId: null,
        reaches: this.reach.hosts(),
        secrets: [],
        withheld: [],
      };

      if (admitted.work.kind !== 'run') {
        return nothingWorn;
      }

      const runId = RunId.of(admitted.work.id);
      const runner = RunnerId.of(admitted.runnerId);
      const wears = await this.wornBy(runId, runner, admitted.workspaceId);

      if (wears.length === 0) {
        return nothingWorn;
      }

      const redeemed = await this.redemptions.redeem({
        workspaceId: admitted.workspaceId,
        runId: runId.value,
        wears,
        recipient: command.recipient,
      });

      if (
        (await this.wornBy(runId, runner, admitted.workspaceId)).length === 0
      ) {
        await this.grants.endedFor(runId.value);
        return nothingWorn;
      }

      return { ...nothingWorn, runId: runId.value, ...redeemed };
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async wornBy(
    runId: RunId,
    runner: RunnerId,
    workspaceId: string,
  ): Promise<readonly string[]> {
    const run = await this.runs.findById(runId);

    return run?.workspaceId.value === workspaceId
      ? run.secretsWornFor(runner)
      : [];
  }
}
