import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { ExchangeWorkloadTokenCommand } from '@runners/application/commands/runner-resource.commands';
import type { ExchangedTokenDto } from '@runners/application/dto/runner.dto';
import type { WorkloadTokensPort } from '@runners/application/ports/workload-tokens.port';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class ExchangeWorkloadTokenHandler
  implements
    CommandHandlerPort<ExchangeWorkloadTokenCommand, ExchangedTokenDto | null>
{
  constructor(
    private readonly trusts: RunnerTrustRepository,
    private readonly workloads: WorkloadTokensPort,
    private readonly runners: RunnerRepository,
    private readonly ids: IdGeneratorPort,
    private readonly tokens: TokenMintPort,
    private readonly workspaces: WorkspaceReaderPort,
  ) {}

  async execute(
    command: ExchangeWorkloadTokenCommand,
  ): Promise<ExchangedTokenDto | null> {
    try {
      const trust = command.trustId.trim()
        ? await this.trusts.find(RunnerTrustId.of(command.trustId))
        : null;

      if (!trust || !(await this.workspaces.isOpen(trust.workspaceId.value))) {
        return null;
      }

      const claims = await this.workloads.verify(command.token, {
        issuer: trust.workload.issuer,
        audience: trust.workload.audience,
      });

      if (!claims || !trust.admits(claims)) {
        return null;
      }

      const name = RunnerName.of(command.name);
      const minted = this.tokens.mint();
      const tokenHash = TokenHash.of(minted.hash);
      const standing = await this.runners.enrolledUnder(trust.id, name);
      const by = Attribution.spotlight(trust.workspaceId);

      if (standing) {
        await this.runners.save(standing.rekeyed(tokenHash, by));

        return { runnerId: standing.id.value, token: minted.token };
      }

      const enrolled = Runner.enrol({
        id: RunnerId.of(this.ids.generate()),
        workspaceId: trust.workspaceId,
        name,
        tokenHash,
        trustId: trust.id,
        by,
      });

      await this.runners.add(enrolled);

      return { runnerId: enrolled.id.value, token: minted.token };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
