import type { RunTokensPort } from '@identity/application/ports/run-tokens.port';
import type { LeasedWork } from '@runners/application/ports/runners.port';
import type { FetchedEgressSecrets } from '@runs/application/dto/egress-secrets.dto';
import type { SandboxHostsPort } from '@runs/application/ports/sandbox-hosts.port';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { Credential } from '@secrets/application/contracts/credential.contract';
import type { RunGrantsPort } from '@secrets/application/ports/run-grants.port';
import type { RunSecretFetchesPort } from '@secrets/application/ports/run-secret-fetches.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const SPOTLIGHT_API = 'spotlight-api';

export interface EgressAuthorized {
  readonly runnerId: string;
  readonly workspaceId: string;
  readonly work: LeasedWork | null;
  readonly sharedEgress: string | null;
}

export interface RunLeasedByRunner {
  readonly run: Run;
  readonly attempt: RunAttempt;
  readonly injectedSecrets: readonly string[];
  readonly usesSpotlightApi: boolean;
}

export class EgressSecretFetches {
  constructor(
    private readonly runs: RunRepository,
    private readonly runSecretFetches: RunSecretFetchesPort,
    private readonly grants: RunGrantsPort,
    private readonly hosts: SandboxHostsPort,
    private readonly runTokens: RunTokensPort,
    private readonly clock: ClockPort,
    private readonly controlPlaneHost: string,
  ) {}

  async fetchFor(
    authorized: EgressAuthorized,
    recipient: string,
  ): Promise<FetchedEgressSecrets> {
    const nothingInjected: FetchedEgressSecrets = {
      outcome: 'fetched',
      runId: null,
      extraAllowedHosts: this.hosts.hosts(),
      bound: [],
      secrets: [],
      denied: [],
      spotlightApi: null,
    };

    if (authorized.work?.kind !== 'run') {
      return nothingInjected;
    }

    const runId = RunId.of(authorized.work.id);
    const runner = RunnerId.of(authorized.runnerId);
    const leased = await this.leasedBy(runId, runner, authorized.workspaceId);

    if (!leased) {
      return nothingInjected;
    }

    if (leased.injectedSecrets.length === 0 && !leased.usesSpotlightApi) {
      return { ...nothingInjected, runId: runId.value };
    }

    const fetched = await this.runSecretFetches.fetchSecrets({
      workspaceId: authorized.workspaceId,
      runId: runId.value,
      attempt: leased.attempt.number,
      injectedSecrets: leased.injectedSecrets,
      recipient,
      sharedEgress: authorized.sharedEgress,
    });
    const issued = leased.usesSpotlightApi
      ? await this.apiFor(leased.run, leased.attempt, recipient)
      : null;
    const still = await this.leasedBy(runId, runner, authorized.workspaceId);

    if (!still?.attempt.equals(leased.attempt)) {
      await this.grants.leaseLost({
        workspaceId: authorized.workspaceId,
        runId: runId.value,
        attempt: leased.attempt.number,
      });
      if (issued) {
        await this.runTokens.revoke(
          WorkspaceId.of(authorized.workspaceId),
          issued.tokenId,
        );
      }
      return nothingInjected;
    }

    return {
      ...nothingInjected,
      runId: runId.value,
      bound: [
        ...new Set([
          ...fetched.secrets.map((each) => each.host),
          ...(issued ? [this.controlPlaneHost] : []),
        ]),
      ].sort(),
      ...fetched,
      spotlightApi: issued ? { sealed: issued.sealed } : null,
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
          injectedSecrets: run
            .injectedSecretsFor(runner)
            .map((each) => each.value),
          usesSpotlightApi: run.apiGrantFor(runner) !== null,
        }
      : null;
  }

  async attemptClaimedBy(
    runId: RunId,
    runner: RunnerId,
    workspaceId: string,
  ): Promise<RunAttempt | null> {
    const run = await this.runs.findById(runId);

    return run?.workspaceId.value === workspaceId
      ? run.attemptClaimedBy(runner)
      : null;
  }

  private async apiFor(
    run: Run,
    attempt: RunAttempt,
    recipient: string,
  ): Promise<{ sealed: string; tokenId: string } | null> {
    if (!run.apiGrant) {
      return null;
    }

    await this.runTokens.revokeFor(run.workspaceId, run.id, attempt.number);
    const grant = run.apiGrant.issuedAt(this.clock.now());
    const token = await this.runTokens.issueFor({
      workspaceId: run.workspaceId,
      runId: run.id,
      attempt: attempt.number,
      issuedBy: grant.issuedBy,
      scopes: [...grant.scopes],
      expiresAt: grant.expiresAt,
    });

    return {
      tokenId: token.id,
      sealed: this.runSecretFetches.sealedFor({
        runId: run.id.value,
        name: SPOTLIGHT_API,
        value: Credential.of(token.token),
        recipient,
      }),
    };
  }
}
