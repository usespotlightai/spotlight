import type { ExchangeWorkloadTokenCommand } from '@identity/application/commands/exchange-workload-token.command';
import type { MintedTokenDto } from '@identity/application/dto/minted-token.dto';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { NoSuchWorkspaceError } from '@identity/domain/exceptions/no-such-workspace.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { WorkloadTokensPort } from '@shared-kernel/application/ports/workload-tokens.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export class ExchangeWorkloadTokenHandler
  implements
    CommandHandlerPort<ExchangeWorkloadTokenCommand, MintedTokenDto | null>
{
  constructor(
    private readonly trusts: WorkspaceTokenTrustRepository,
    private readonly tokens: WorkspaceTokenRepository,
    private readonly workloads: WorkloadTokensPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly ids: IdGeneratorPort,
    private readonly mint: TokenMintPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: ExchangeWorkloadTokenCommand,
  ): Promise<MintedTokenDto | null> {
    try {
      if (!command.trustId.trim() || !command.workloadToken.trim()) {
        return null;
      }

      const trust = await this.trusts.find(
        WorkspaceTokenTrustId.of(command.trustId),
      );

      if (!trust) {
        return null;
      }

      const workload = await this.workloads.verify(command.workloadToken, {
        issuer: trust.workload.issuer,
        audience: trust.workload.audience,
      });

      if (
        !workload ||
        !trust.admits(workload) ||
        !(await this.workspaces.isOpen(trust.workspaceId.value))
      ) {
        return null;
      }

      const minted = this.mint.mint();
      const now = this.clock.now();
      const exchanged = await this.transaction.run(async () => {
        const held = await this.trusts.holding(trust.id);

        if (!held?.admits(workload)) {
          return null;
        }

        const issued = held.mintFor(workload, {
          id: WorkspaceTokenId.of(this.ids.generate()),
          hash: TokenHash.of(minted.hash),
          now,
          client: command.client,
        });

        await this.tokens.add(issued);

        return { issued, expiresAt: held.lifetime.endingFrom(now) };
      });

      return exchanged
        ? {
            token: minted.token,
            tokenId: exchanged.issued.id.value,
            workspaceId: exchanged.issued.workspaceId.value,
            scopes: exchanged.issued.scopes.all.map((each) => each.value),
            expiresAt: exchanged.expiresAt.toISOString(),
          }
        : null;
    } catch (error) {
      if (error instanceof NoSuchWorkspaceError) {
        return null;
      }

      rethrowAsFault(error);
    }
  }
}
