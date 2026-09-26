import type { WornSecret } from '@configuration/application/ports/held-integrations.port';
import {
  CONFIGURED_RESOURCES,
  type ConfiguredResource,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export type HeldKind = Exclude<ConfiguredResource, 'workspace-token'>;

export const HELD_KINDS: readonly HeldKind[] = CONFIGURED_RESOURCES.filter(
  (kind): kind is HeldKind => kind !== 'workspace-token',
);

interface Held {
  readonly id: string;
  readonly address: string;
}

interface HeldByWorkspace extends Held {
  readonly heldBy: 'workspace';
}

interface HeldByTeam extends Held {
  readonly heldBy: 'team';
  readonly teamKey: string;
}

export type HeldResourceDto =
  | (Held & {
      readonly kind: 'workspace';
      readonly slug: string;
      readonly name: string;
    })
  | (HeldByWorkspace & {
      readonly kind: 'team';
      readonly key: string;
      readonly name: string;
    })
  | (HeldByWorkspace & {
      readonly kind: 'secret';
      readonly name: string;
      readonly source: {
        readonly kind: string;
        readonly secretId: string | null;
        readonly field: string | null;
      };
      readonly bindings: readonly {
        readonly host: string;
        readonly header: string;
        readonly prefix: string;
      }[];
      readonly keepsValue: boolean;
      readonly valueVersion: number | null;
    })
  | (HeldByWorkspace & {
      readonly kind: 'workspace-token-trust';
      readonly key: string;
      readonly issuer: string;
      readonly audience: string;
      readonly subject: string;
      readonly claims: Readonly<Record<string, string>>;
      readonly scopes: readonly string[];
      readonly lifetimeMinutes: number;
    })
  | (HeldByWorkspace & {
      readonly kind: 'runner-trust';
      readonly key: string;
      readonly issuer: string;
      readonly subject: string;
      readonly audience: string;
      readonly labels: readonly string[];
    })
  | (HeldByWorkspace & {
      readonly kind: 'runner-pool';
      readonly key: string;
      readonly labels: readonly string[];
      readonly maxRuns: number | null;
      readonly tokenVersion: number | null;
      readonly provision: {
        readonly url: string;
        readonly secretVersion: number | null;
      } | null;
    })
  | (HeldByWorkspace & {
      readonly kind: 'workspace-runners';
      readonly trusts: readonly string[];
      readonly pools: readonly string[];
    })
  | (HeldByTeam & {
      readonly kind: 'line';
      readonly key: string;
      readonly definition: Readonly<Record<string, unknown>>;
    })
  | (HeldByTeam & {
      readonly kind: 'skill';
      readonly key: string;
      readonly files: Readonly<Record<string, string>>;
    })
  | (HeldByTeam & {
      readonly kind: 'integration';
      readonly source: string;
      readonly definition: Readonly<Record<string, unknown>>;
      readonly secretsWorn: readonly WornSecret[];
    })
  | (HeldByTeam & {
      readonly kind: 'harness-profile';
      readonly key: string;
      readonly permissions: {
        readonly allow: readonly string[];
        readonly ask: readonly string[];
        readonly deny: readonly string[];
      };
      readonly mcpServers: readonly {
        readonly name: string;
        readonly command: string;
        readonly args: readonly string[];
        readonly env: Readonly<Record<string, string>>;
      }[];
      readonly native: Readonly<Record<string, unknown>>;
      readonly secretsWorn: readonly WornSecret[];
    });

export interface HeldConfigurationDto {
  readonly workspaceId: string;
  readonly workspaceSlug: string;
  readonly resources: readonly HeldResourceDto[];
}

export interface HeldResourceConfigurationDto {
  readonly configuration: HeldConfigurationDto;
  readonly resource: HeldResourceDto;
}
