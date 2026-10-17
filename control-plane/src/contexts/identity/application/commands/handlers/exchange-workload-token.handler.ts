import type { ExchangeWorkloadTokenCommand } from '@identity/application/commands/exchange-workload-token.command';
import type { IssuedTokenDto } from '@identity/application/dto/issued-token.dto';
import { NoSuchWorkspaceError } from '@identity/domain/exceptions/no-such-workspace.error';
import { WorkloadNotAdmittedError } from '@identity/domain/exceptions/workload-not-admitted.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { WorkloadTokensPort } from '@shared-kernel/application/ports/workload-tokens.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export class ExchangeWorkloadTokenHandler
  implements
    CommandHandlerPort<ExchangeWorkloadTokenCommand, IssuedTokenDto | null>
{
  constructor(
    private readonly trusts: WorkspaceTokenTrustRepository,
    private readonly tokens: WorkspaceTokenRepository,
    private readonly workloads: WorkloadTokensPort,
    private readonly ids: IdGeneratorPort,
    private readonly issuer: TokenIssuer,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: ExchangeWorkloadTokenCommand,
  ): Promise<IssuedTokenDto | null> {
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

      if (!workload) {
        return null;
      }

      const newToken = this.issuer.issue();
      const now = this.clock.now();
      const exchanged = await this.transaction.inTransaction(async () => {
        const locked = await this.trusts.findLocked(trust.id);

        if (!locked) {
          return null;
        }

        const issued = locked.issueFor(workload, {
          id: WorkspaceTokenId.of(this.ids.generate()),
          hash: TokenHash.of(newToken.hash),
          now,
          client: command.client,
        });

        await this.tokens.add(issued);

        return issued;
      });

      return exchanged
        ? {
            token: newToken.token,
            tokenId: exchanged.id.value,
            workspaceId: exchanged.workspaceId.value,
            scopes: exchanged.scopes.all.map((each) => each.value),
            expiresAt: exchanged.expiry().toISOString(),
          }
        : null;
    } catch (error) {
      if (
        error instanceof WorkloadNotAdmittedError ||
        error instanceof NoSuchWorkspaceError
      ) {
        return null;
      }

      rethrowAsApplicationError(error);
    }
  }
}
