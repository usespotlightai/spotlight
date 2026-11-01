import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  Credentials,
  SigningSecrets,
} from '@integrations/application/ports/integration-runtime.port';
import { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { ConnectionRefresh } from '@integrations/application/services/connection-refresh.service';
import { SpotlightCredentials } from '@integrations/application/services/spotlight-credentials';
import { SpotlightSigningSecrets } from '@integrations/application/services/spotlight-signing-secrets';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';
import { VerifyingSecret } from '@secrets/application/contracts/verifying-secret.contract';
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
  readonly location?: 'header' | 'query';
  readonly name?: string;
  readonly prefix?: string;
  readonly value: string;
}

const denied = (message: string) =>
  Object.assign(new Error(message), { kind: 'not-allowed' as const });

export const injecting = (bound: Readonly<Record<string, Bound>> = {}) => {
  const granted = new Set<string>();

  const injected = (
    request: SpotlightRequest,
    run: string | null,
    standIns = false,
  ) =>
    InjectedSecrets.of(
      request.secrets.map((name) => {
        const secret = bound[name];
        const host = new URL(request.url).hostname;

        if (!secret) {
          throw Object.assign(
            new Error(`Secret ${name} not found. Please create it first.`),
            { kind: 'conflict' as const },
          );
        }

        if (secret.host !== host) {
          throw denied(`The ${name} secret is not bound to ${host}`);
        }

        if (run !== null && !granted.has(`${run}:${name}`)) {
          throw denied(`This run was not granted the ${name} secret`);
        }

        const bare = standIns ? `spotlight-egress:${name}` : secret.value;

        return {
          location: secret.location ?? 'header',
          name: secret.name ?? 'authorization',
          value: `${secret.prefix ?? ''}${bare}`,
          bare,
        };
      }),
    );

  const grant = vi.fn(async (runGrant: RunGrant) => {
    for (const name of runGrant.secrets) {
      if (!bound[name]) {
        throw new Error(`Secret ${name} not found. Please create it first.`);
      }

      granted.add(`${runGrant.runId}:${name}`);
    }
  });
  const forRun = vi.fn(async (request: RunRequest) =>
    injected(request, request.runId),
  );
  const forSpotlight = vi.fn(async (request: SpotlightRequest) =>
    injected(request, null),
  );

  const standInsFor = vi.fn(async (request: SpotlightRequest) =>
    injected(request, null, true),
  );
  const standInsForRun = vi.fn(async (request: RunRequest) =>
    injected(request, request.runId, true),
  );

  const forVerifying = vi.fn(async (request: VerifyingRequest) => {
    const secret = bound[request.secret];

    if (!secret) {
      throw Object.assign(
        new Error(
          `Secret ${request.secret} not found. Please create it first.`,
        ),
        { kind: 'conflict' as const },
      );
    }

    return VerifyingSecret.of(secret.value);
  });

  const injection: SecretInjectionPort = {
    grant,
    forRun,
    forSpotlight,
    standInsFor,
    standInsForRun,
    forVerifying,
  };

  return {
    injection,
    grant,
    forRun,
    forSpotlight,
    standInsFor,
    standInsForRun,
    forVerifying,
  };
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

export const callAuthFor = (
  injection: SecretInjectionPort = injecting().injection,
): CallAuthResolver =>
  new CallAuthResolver(
    { of: async () => null } as unknown as IntegrationConnectionRepository,
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
    { afterUnauthorized: async () => null } as unknown as ConnectionRefresh,
  );
