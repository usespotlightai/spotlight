import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import { HostReach } from '@integrations/application/services/host-reach.service';
import { SpotlightCredentials } from '@integrations/application/services/spotlight-credentials';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { WornSecrets } from '@secrets/application/contracts/worn-secrets.contract';
import type {
  RunGrant,
  RunRequest,
  SecretInjectionPort,
  SpotlightRequest,
} from '@secrets/application/ports/secret-injection.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { vi } from 'vitest';

interface Bound {
  readonly host: string;
  readonly header?: string;
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
            new Error(`The workspace holds no secret named ${name}`),
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
          name: secret.header ?? 'authorization',
          value: `${secret.prefix ?? ''}${secret.value}`,
        };
      }),
    );

  const grant = vi.fn(async (asked: RunGrant) => {
    for (const name of asked.secrets) {
      if (!bound[name]) {
        throw new Error(`The workspace holds no secret named ${name}`);
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

  const injection: SecretInjectionPort = { grant, forRun, forSpotlight };

  return { injection, grant, forRun, forSpotlight };
};

export const credentialsFor = (
  bound: Readonly<Record<string, Bound>> = {},
): Credentials =>
  new SpotlightCredentials(injecting(bound).injection, async () => 'ws_1');

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
    injection,
  );
