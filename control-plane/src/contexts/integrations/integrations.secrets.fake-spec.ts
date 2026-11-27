import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  Credentials,
  SigningSecrets,
} from '@integrations/application/ports/integration-runtime.port';
import { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { ConnectionRefresh } from '@integrations/application/services/connection-refresh.service';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import {
  InjectedCallCredentials,
  SpotlightCredentials,
  SpotlightSigningSecrets,
} from '@integrations/infrastructure/acl/spotlight-credentials.adapter';
import { injectedSecretsOf } from '@secrets/application/contracts/injected-secrets.fake-spec';
import { VerifyingSecret } from '@secrets/application/contracts/verifying-secret.contract';
import type {
  RunGrant,
  RunRequest,
  SecretInjectionPort,
  SpotlightRequest,
  VerifyingRequest,
} from '@secrets/application/ports/secret-injection.port';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { type Mock, vi } from 'vitest';

interface Bound {
  readonly host: string;
  readonly location?: 'header' | 'query';
  readonly name?: string;
  readonly prefix?: string;
  readonly value: string;
}

class SecretDenied extends DomainError {
  readonly kind = 'not-allowed' as const;
}

const denied = (message: string) => new SecretDenied(message);

type Port = SecretInjectionPort;

interface Injecting {
  readonly injection: Port;
  readonly grant: Mock<Port['grant']>;
  readonly forRun: Mock<Port['forRun']>;
  readonly forSpotlight: Mock<Port['forSpotlight']>;
  readonly standInsFor: Mock<Port['standInsFor']>;
  readonly standInsForRun: Mock<Port['standInsForRun']>;
  readonly forVerifying: Mock<Port['forVerifying']>;
}

export const injecting = (
  bound: Readonly<Partial<Record<string, Bound>>> = {},
): Injecting => {
  const granted = new Set<string>();

  const injected = (
    request: SpotlightRequest,
    run: string | null,
    standIns = false,
  ): Promise<ReturnType<typeof injectedSecretsOf>> =>
    new Promise((resolve) => {
      resolve(
        injectedSecretsOf(
          request.secrets.map((name) => {
            const secret = bound[name];
            const host = new URL(request.url).hostname;

            if (secret === undefined) {
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
        ),
      );
    });

  const grant = vi.fn<Port['grant']>((runGrant: RunGrant) => {
    for (const name of runGrant.secrets) {
      if (bound[name] === undefined) {
        return Promise.reject(
          new Error(`Secret ${name} not found. Please create it first.`),
        );
      }

      granted.add(`${runGrant.runId}:${name}`);
    }

    return Promise.resolve();
  });
  const forRun = vi.fn<Port['forRun']>((request: RunRequest) =>
    injected(request, request.runId),
  );
  const forSpotlight = vi.fn<Port['forSpotlight']>(
    (request: SpotlightRequest) => injected(request, null),
  );

  const standInsFor = vi.fn<Port['standInsFor']>((request: SpotlightRequest) =>
    injected(request, null, true),
  );
  const standInsForRun = vi.fn<Port['standInsForRun']>((request: RunRequest) =>
    injected(request, request.runId, true),
  );

  const forVerifying = vi.fn<Port['forVerifying']>(
    (request: VerifyingRequest) => {
      const secret = bound[request.secret];

      if (secret === undefined) {
        return Promise.reject(
          Object.assign(
            new Error(
              `Secret ${request.secret} not found. Please create it first.`,
            ),
            { kind: 'conflict' as const },
          ),
        );
      }

      return Promise.resolve(VerifyingSecret.of(secret.value));
    },
  );

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
  bound: Readonly<Partial<Record<string, Bound>>> = {},
): Credentials =>
  new SpotlightCredentials(injecting(bound).injection, () =>
    Promise.resolve(WorkspaceId.of('ws_1')),
  );

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
    partial<IntegrationConnectionRepository>({
      of: () => Promise.resolve(null),
    }),
    {
      find: (id) =>
        Promise.resolve({
          id,
          workspaceId: WorkspaceId.of('ws_1'),
          key: 'platform',
          name: 'Platform',
          members: [],
        }),
      inWorkspace: () => Promise.resolve([]),
    } satisfies TeamDirectoryPort,
    partial<WorkspaceAccessPort>({
      inWorkspaceOfTeam: () => Promise.resolve(null),
    }),
    injection,
    new InjectedCallCredentials(injection),
    partial<ConnectionRefresh>({
      afterUnauthorized: () => Promise.resolve(null),
    }),
  );
