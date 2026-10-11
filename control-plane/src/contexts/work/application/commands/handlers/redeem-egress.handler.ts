import type { RunTokensPort } from '@identity/application/ports/run-tokens.port';
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
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';

const SPOTLIGHT_API = 'spotlight-api';

const SPOTLIGHT_API_SCOPES = ['plan'];

const SPOTLIGHT_API_LIFETIME_MS = 60 * 60 * 1_000;

interface Held {
  readonly run: Run;
  readonly attempt: RunAttempt;
  readonly wears: readonly string[];
  readonly reachesApi: boolean;
}

export class RedeemEgressHandler
  implements CommandHandlerPort<RedeemEgressCommand, EgressRedemptionDto>
{
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly runs: RunRepository,
    private readonly redemptions: RunRedemptionsPort,
    private readonly grants: RunGrantsPort,
    private readonly reach: SandboxReachPort,
    private readonly chats: ChatRepository,
    private readonly runTokens: RunTokensPort,
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
        spotlightApi: null,
      };

      if (admitted.work.kind !== 'run') {
        return nothingWorn;
      }

      const runId = RunId.of(admitted.work.id);
      const runner = RunnerId.of(admitted.runnerId);
      const held = await this.holdOf(runId, runner, admitted.workspaceId);

      if (!held || (held.wears.length === 0 && !held.reachesApi)) {
        return nothingWorn;
      }

      const redeemed =
        held.wears.length > 0
          ? await this.redemptions.redeem({
              workspaceId: admitted.workspaceId,
              runId: runId.value,
              attempt: held.attempt.number,
              wears: held.wears,
              recipient: command.recipient,
            })
          : { secrets: [], withheld: [] };
      const minted = held.reachesApi
        ? await this.apiFor(held.run, held.attempt, command.recipient)
        : null;
      const still = await this.holdOf(runId, runner, admitted.workspaceId);

      if (!still?.attempt.equals(held.attempt)) {
        await this.grants.holdLost({
          workspaceId: admitted.workspaceId,
          runId: runId.value,
          attempt: held.attempt.number,
        });
        if (minted) {
          await this.runTokens.revoke(admitted.workspaceId, minted.tokenId);
        }
        return nothingWorn;
      }

      return {
        ...nothingWorn,
        runId: runId.value,
        ...redeemed,
        spotlightApi: minted ? { sealed: minted.sealed } : null,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async apiFor(
    run: Run,
    attempt: RunAttempt,
    recipient: string,
  ): Promise<{ sealed: string; tokenId: string } | null> {
    const chat = run.chatId ? await this.chats.find(run.chatId) : null;

    if (!chat) {
      return null;
    }

    const token = await this.runTokens.mintFor({
      workspaceId: run.workspaceId.value,
      runId: run.id.value,
      attempt: attempt.number,
      issuedBy: chat.startedBy.value,
      scopes: SPOTLIGHT_API_SCOPES,
      expiresAt: new Date(
        this.clock.now().getTime() + SPOTLIGHT_API_LIFETIME_MS,
      ),
    });

    return {
      tokenId: token.id,
      sealed: this.redemptions.sealedFor({
        runId: run.id.value,
        name: SPOTLIGHT_API,
        value: token.token,
        recipient,
      }),
    };
  }

  private async holdOf(
    runId: RunId,
    runner: RunnerId,
    workspaceId: string,
  ): Promise<Held | null> {
    const run = await this.runs.findById(runId);

    return run?.workspaceId.value === workspaceId && run.isHeldBy(runner)
      ? {
          run,
          attempt: run.currentAttempt,
          wears: run.secretsWornFor(runner).map((each) => each.value),
          reachesApi: run.reachesSpotlightApiFor(runner),
        }
      : null;
  }
}
