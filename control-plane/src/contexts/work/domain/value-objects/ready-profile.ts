import type { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

const PERMISSION_KINDS = ['read', 'edit', 'execute'] as const;

type PermissionKind = (typeof PERMISSION_KINDS)[number];

type PermissionDecision = 'allow' | 'ask' | 'deny';

interface PermissionRuleParts {
  readonly decision: PermissionDecision;
  readonly kind: PermissionKind;
  readonly pattern: string | null;
}

interface McpServerParts {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

interface HarnessSettings {
  readonly rules: readonly PermissionRuleParts[];
  readonly mcpServers: readonly McpServerParts[];
  readonly native: Readonly<Record<string, unknown>>;
}

export interface ReadyProfile extends HarnessSettings {
  readonly key: ProfileKey;
  readonly injectedSecrets: readonly SecretName[];
}

export const withoutServers = (profile: ReadyProfile): ReadyProfile => ({
  ...profile,
  mcpServers: [],
  injectedSecrets: [],
});
