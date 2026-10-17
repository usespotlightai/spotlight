import type {
  HookConfigMatch,
  HookConfigSigning,
  HookConfigStep,
} from '@configuration/application/ports/hook-configs.port';
import type { SecretReferenceAt } from '@configuration/domain/value-objects/secret-reference-at.vo';
import {
  CONFIGURED_RESOURCES,
  type ConfiguredResource,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { LineDefinition } from '@work/application/contracts/line-definition.contract';

const NOT_EXPORTED = [
  'workspace-token',
  'replay-candidate',
  'replay',
  'replay-set',
  'replay-search',
  'replay-check',
  'config-pull-request',
] as const;

export type ExportableKind = Exclude<
  ConfiguredResource,
  (typeof NOT_EXPORTED)[number]
>;

export const EXPORTABLE_KINDS: readonly ExportableKind[] =
  CONFIGURED_RESOURCES.filter(
    (kind): kind is ExportableKind =>
      !(NOT_EXPORTED as readonly string[]).includes(kind),
  );

interface Exportable {
  readonly id: string;
  readonly address: string;
}

interface WorkspaceOwned extends Exportable {
  readonly ownedBy: 'workspace';
}

interface TeamOwned extends Exportable {
  readonly ownedBy: 'team';
  readonly teamKey: string;
}

export type ExportableResourceDto =
  | (Exportable & {
      readonly kind: 'workspace';
      readonly slug: string;
      readonly name: string;
    })
  | (WorkspaceOwned & {
      readonly kind: 'team';
      readonly key: string;
      readonly name: string;
    })
  | (WorkspaceOwned & {
      readonly kind: 'secret';
      readonly name: string;
      readonly source: {
        readonly kind: string;
        readonly secretId: string | null;
        readonly field: string | null;
      };
      readonly bindings: readonly {
        readonly host: string;
        readonly location: string;
        readonly name: string;
        readonly prefix: string;
      }[];
      readonly keepsValue: boolean;
      readonly valueVersion: number | null;
    })
  | (WorkspaceOwned & {
      readonly kind: 'workspace-token-trust';
      readonly key: string;
      readonly issuer: string;
      readonly audience: string;
      readonly subject: string;
      readonly claims: Readonly<Record<string, string>>;
      readonly scopes: readonly string[];
      readonly lifetimeMinutes: number;
    })
  | (WorkspaceOwned & {
      readonly kind: 'runner-trust';
      readonly key: string;
      readonly issuer: string;
      readonly subject: string;
      readonly audience: string;
      readonly labels: readonly string[];
    })
  | (WorkspaceOwned & {
      readonly kind: 'runner-pool';
      readonly key: string;
      readonly labels: readonly string[];
      readonly maxRuns: number | null;
      readonly tokenVersion: number | null;
      readonly provision: {
        readonly url: string;
        readonly secretVersion: number | null;
        readonly egress: string | null;
        readonly egressTraffic: 'all' | 'bound';
      } | null;
    })
  | (WorkspaceOwned & {
      readonly kind: 'egress';
      readonly key: string;
      readonly url: string;
      readonly tokenVersion: number | null;
    })
  | (WorkspaceOwned & {
      readonly kind: 'workspace-runners';
      readonly trusts: readonly string[];
      readonly pools: readonly string[];
    })
  | (TeamOwned & {
      readonly kind: 'line';
      readonly key: string;
      readonly definition: LineDefinition;
    })
  | (TeamOwned & {
      readonly kind: 'skill';
      readonly key: string;
      readonly files: Readonly<Record<string, string>>;
    })
  | (TeamOwned & {
      readonly kind: 'integration';
      readonly source: string;
      readonly definition: Readonly<Record<string, unknown>>;
      readonly secretReferences: readonly SecretReferenceAt[];
    })
  | (TeamOwned & {
      readonly kind: 'hook';
      readonly key: string;
      readonly on: string;
      readonly match: HookConfigMatch;
      readonly when: string | null;
      readonly vars: Readonly<Record<string, string>>;
      readonly steps: readonly HookConfigStep[];
      readonly signing: HookConfigSigning | null;
      readonly failure: string | null;
      readonly timeoutSeconds: number | null;
    })
  | (TeamOwned & {
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
      readonly secretReferences: readonly SecretReferenceAt[];
    });

export interface ExportableConfigurationDto {
  readonly workspaceId: string;
  readonly workspaceSlug: string;
  readonly resources: readonly ExportableResourceDto[];
}

export interface ExportableResourceConfigurationDto {
  readonly configuration: ExportableConfigurationDto;
  readonly resource: ExportableResourceDto;
}
