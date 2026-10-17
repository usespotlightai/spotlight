import type { ProvisionSecretsPort } from '@runners/application/ports/provision-secrets.port';
import type { ParsedPoolAccess } from '@runners/application/ports/runner-definitions.port';
import type { GivenAccess } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const givenAccess = async (
  access: ParsedPoolAccess,
  to: { readonly id: RunnerPoolId; readonly workspaceId: WorkspaceId },
  tokens: TokenMintPort,
  secrets: ProvisionSecretsPort,
): Promise<GivenAccess> =>
  access.mode === 'pull'
    ? {
        mode: 'pull',
        tokenHash: access.token
          ? TokenHash.of(tokens.hash(access.token.revealed()))
          : null,
        tokenVersion: access.tokenVersion,
      }
    : {
        mode: 'push',
        url: access.url,
        secret: access.secret ? await secrets.sealed(to, access.secret) : null,
        secretVersion: access.secretVersion,
        egress: access.egress,
        egressTraffic: access.egressTraffic,
      };

export const issuedTo = (
  given: GivenAccess,
  minted: { readonly hash: string },
): GivenAccess =>
  given.mode === 'pull'
    ? { ...given, tokenHash: TokenHash.of(minted.hash) }
    : given;
