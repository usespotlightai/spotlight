import type {
  IssuedRunToken,
  RunTokensPort,
  RunTokenWanted,
} from '@identity/application/ports/run-tokens.port';
import { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { WorkspaceTokenVersionConflictError } from '@identity/domain/exceptions/workspace-token-version-conflict.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';

export class RunTokens implements RunTokensPort {
  constructor(
    private readonly tokens: WorkspaceTokenRepository,
    private readonly issuer: TokenIssuer,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async issueFor(wanted: RunTokenWanted): Promise<IssuedRunToken> {
    const newToken = this.issuer.issue();
    const id = this.ids.generate();
    const token = WorkspaceToken.forRun({
      id: WorkspaceTokenId.of(id),
      workspaceId: WorkspaceId.of(wanted.workspaceId),
      name: TokenName.of(`run-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
      scopes: TokenScopes.named(wanted.scopes),
      hash: TokenHash.of(newToken.hash),
      issuedBy: UserId.of(wanted.issuedBy),
      runId: RunId.of(wanted.runId),
      attempt: wanted.attempt,
      expiresAt: wanted.expiresAt,
      now: this.clock.now(),
    });

    await this.transaction.inTransaction(() => this.tokens.add(token));

    return { id, token: newToken.token };
  }

  async revoke(workspaceId: string, tokenId: string): Promise<void> {
    const token = await this.tokens.find(WorkspaceTokenId.of(tokenId));

    if (token?.workspaceId.value === workspaceId && token.runId) {
      await this.revoked(token);
    }
  }

  async revokeFor(
    workspaceId: string,
    runId: string,
    attempt: number | null,
  ): Promise<void> {
    for (const token of await this.tokens.issuedForRun(
      WorkspaceId.of(workspaceId),
      RunId.of(runId),
      attempt,
    )) {
      await this.revoked(token);
    }
  }

  private async revoked(token: WorkspaceToken): Promise<void> {
    try {
      await this.transaction.inTransaction(() =>
        this.tokens.save(
          token.revoke(Attribution.spotlight(token.workspaceId)),
        ),
      );
    } catch (error) {
      if (!(error instanceof WorkspaceTokenVersionConflictError)) {
        throw error;
      }
    }
  }
}
