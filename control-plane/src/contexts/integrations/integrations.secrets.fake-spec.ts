import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  Credentials,
  SigningSecrets,
} from '@integrations/application/ports/integration-runtime.port';
import type { ConnectionRenewal } from '@integrations/application/services/connection-renewal.service';
import { HostReach } from '@integrations/application/services/host-reach.service';
import { SpotlightCredentials } from '@integrations/application/services/spotlight-credentials';
import { SpotlightSigningSecrets } from '@integrations/application/services/spotlight-signing-secrets';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { VerifyingSecret } from '@secrets/application/contracts/verifying-secret.contract';
import { WornSecrets } from '@secrets/application/contracts/worn-secrets.contract';
import type {
  RunGrant,
  RunRequest,
  SecretInjectionPort,
  SpotlightRequest,
  VerifyingRequest,
} from '@secrets/application/ports/secret-injection.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { vi } from 'vitest';

interface Bound {
  readonly host: string;
  readonly carrier?: 'header' | 'query';
  readonly name?: string;
  readonly prefix?: string;
  readonly value: string;
}

const refused = (message: string) =>
  Object.assign(new Error(message), { violation: 'not-allowed' as const });

export const injecting = (bound: Readonly<Record<string, Bound>> = {}) => {
  const granted = new Set<string>();

  const worn = (request: SpotlightRequest, run: string | null) =>
    WornSecrets.of(
      request.secrets.map((name) => {
        const secret = bound[name];
        const host = new URL(request.url).hostname;

        if (!secret) {
          throw Object.assign(
            new Error(`Secret ${name} not found. Please define it first.`),
            { violation: 'conflict' as const },
          );
        }

        if (secret.host !== host) {
          throw refused(`The ${name} secret is not bound to ${host}`);
        }

        if (run !== null && !granted.has(`${run}:${name}`)) {
          throw refused(`This run was not granted the ${name} secret`);
        }

        return {
          carrier: secret.carrier ?? 'header',
          name: secret.name ?? 'authorization',
          value: `${secret.prefix ?? ''}${secret.value}`,
          bare: secret.value,
        };
      }),
    );

  const grant = vi.fn(async (asked: RunGrant) => {
    for (const name of asked.secrets) {
      if (!bound[name]) {
        throw new Error(`Secret ${name} not found. Please define it first.`);
      }

      granted.add(`${asked.runId}:${name}`);
    }
  });
  const forRun = vi.fn(async (request: RunRequest) =>
    worn(request, request.runId),
  );
  const forSpotlight = vi.fn(async (request: SpotlightRequest) =>
    worn(request, null),
  );

  const forVerifying = vi.fn(async (request: VerifyingRequest) => {
    const secret = bound[request.secret];

    if (!secret) {
      throw Object.assign(
        new Error(
          `Secret ${request.secret} not found. Please define it first.`,
        ),
        { violation: 'conflict' as const },
      );
    }

    return VerifyingSecret.of(secret.value);
  });

  const injection: SecretInjectionPort = {
    grant,
    forRun,
    forSpotlight,
    forVerifying,
  };

  return { injection, grant, forRun, forSpotlight, forVerifying };
};

export const credentialsFor = (
  bound: Readonly<Record<string, Bound>> = {},
): Credentials =>
  new SpotlightCredentials(injecting(bound).injection, async () => 'ws_1');

export const signingFor = (
  secrets: Readonly<Record<string, string>> = {},
): SigningSecrets =>
  new SpotlightSigningSecrets(
    injecting(
      Object.fromEntries(
        Object.entries(secrets).map(([name, value]) => [
          name,
          { host: 'spotlight.invalid', value },
        ]),
      ),
    ).injection,
    WorkspaceId.of('ws_1'),
  );

export const reachFor = (
  injection: SecretInjectionPort = injecting().injection,
): HostReach =>
  new HostReach(
    { of: async () => null } as unknown as HostConnectionRepository,
    {
      find: async (id) => ({
        id,
        workspaceId: WorkspaceId.of('ws_1'),
        key: 'platform',
        name: 'Platform',
        members: [],
      }),
      inWorkspace: async () => [],
    } satisfies TeamDirectoryPort,
    { onTeam: async () => null } as unknown as WorkspaceAccessPort,
    injection,
    { afterRefusal: async () => null } as unknown as ConnectionRenewal,
  );
