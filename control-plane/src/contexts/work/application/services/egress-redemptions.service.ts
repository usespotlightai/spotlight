import type { RunTokensPort } from '@identity/application/ports/run-tokens.port';
import type { LeasedWork } from '@runners/application/ports/runners.port';
import type { RunGrantsPort } from '@secrets/application/ports/run-grants.port';
import type { RunRedemptionsPort } from '@secrets/application/ports/run-redemptions.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { EgressRedeemed } from '@work/application/dto/egress-redemption.dto';
import type { SandboxReachPort } from '@work/application/ports/sandbox-reach.port';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';

const SPOTLIGHT_API = 'spotlight-api';

const SPOTLIGHT_API_SCOPES = ['plan'];

const SPOTLIGHT_API_LIFETIME_MS = 60 * 60 * 1_000;

export interface EgressAdmitted {
  readonly runnerId: string;
  readonly workspaceId: string;
  readonly work: LeasedWork | null;
  readonly sharedEgress: string | null;
}

export interface RunLeasedByRunner {
  readonly run: Run;
  readonly attempt: RunAttempt;
  readonly wears: readonly string[];
  readonly reachesApi: boolean;
}

export class EgressRedemptions {
  constructor(
    private readonly runs: RunRepository,
    private readonly redemptions: RunRedemptionsPort,
    private readonly grants: RunGrantsPort,
    private readonly reach: SandboxReachPort,
    private readonly chats: ChatRepository,
    private readonly runTokens: RunTokensPort,
    private readonly clock: ClockPort,
    private readonly controlPlaneHost: string,
  ) {}

  async redeemedFor(
    admitted: EgressAdmitted,
    recipient: string,
  ): Promise<EgressRedeemed> {
    const nothingWorn: EgressRedeemed = {
      outcome: 'redeemed',
      runId: null,
      reaches: this.reach.hosts(),
      bound: [],
      secrets: [],
      withheld: [],
      spotlightApi: null,
    };

    if (admitted.work?.kind !== 'run') {
      return nothingWorn;
    }

    const runId = RunId.of(admitted.work.id);
    const runner = RunnerId.of(admitted.runnerId);
    const leased = await this.leasedBy(runId, runner, admitted.workspaceId);

    if (!leased) {
      return nothingWorn;
    }

    if (leased.wears.length === 0 && !leased.reachesApi) {
      return { ...nothingWorn, runId: runId.value };
    }

    const redeemed = await this.redemptions.redeem({
      workspaceId: admitted.workspaceId,
      runId: runId.value,
      attempt: leased.attempt.number,
      wears: leased.wears,
      recipient,
      sharedEgress: admitted.sharedEgress,
    });
    const minted = leased.reachesApi
      ? await this.apiFor(leased.run, leased.attempt, recipient)
      : null;
    const still = await this.leasedBy(runId, runner, admitted.workspaceId);

    if (!still?.attempt.equals(leased.attempt)) {
      await this.grants.leaseLost({
        workspaceId: admitted.workspaceId,
        runId: runId.value,
        attempt: leased.attempt.number,
      });
      if (minted) {
        await this.runTokens.revoke(admitted.workspaceId, minted.tokenId);
      }
      return nothingWorn;
    }

    return {
      ...nothingWorn,
      runId: runId.value,
      bound: [
        ...new Set([
          ...redeemed.secrets.map((each) => each.host),
          ...(minted ? [this.controlPlaneHost] : []),
        ]),
      ].sort(),
      ...redeemed,
      spotlightApi: minted ? { sealed: minted.sealed } : null,
    };
  }

  async leasedBy(
    runId: RunId,
    runner: RunnerId,
    workspaceId: string,
  ): Promise<RunLeasedByRunner | null> {
    const run = await this.runs.findById(runId);

    return run?.workspaceId.value === workspaceId && run.isLeasedBy(runner)
      ? {
          run,
          attempt: run.currentAttempt,
          wears: run.secretsWornFor(runner).map((each) => each.value),
          reachesApi: run.reachesSpotlightApiFor(runner),
        }
      : null;
  }

  async attemptWorkedBy(
    runId: RunId,
    runner: RunnerId,
    workspaceId: string,
  ): Promise<RunAttempt | null> {
    const run = await this.runs.findById(runId);

    return run?.workspaceId.value === workspaceId
      ? run.attemptWorkedBy(runner)
      : null;
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

    await this.runTokens.revokeFor(
      run.workspaceId.value,
      run.id.value,
      attempt.number,
    );
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
}
