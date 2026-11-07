import type { ProvisionSecretsPort } from '@runners/application/ports/provision-secrets.port';
import type { ParsedPoolAccess } from '@runners/application/ports/runner-definitions.port';
import type { AccessInput } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const poolAccessInput = async (
  access: ParsedPoolAccess,
  to: { readonly id: PoolId; readonly workspaceId: WorkspaceId },
  tokens: TokenIssuer,
  secrets: ProvisionSecretsPort,
): Promise<AccessInput> =>
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
        secret: access.secret ? await secrets.encrypt(to, access.secret) : null,
        secretVersion: access.secretVersion,
        egress: access.egress,
        egressTraffic: access.egressTraffic,
      };

export const issuedTo = (
  accessInput: AccessInput,
  issued: { readonly hash: string },
): AccessInput =>
  accessInput.mode === 'pull'
    ? { ...accessInput, tokenHash: TokenHash.of(issued.hash) }
    : accessInput;
