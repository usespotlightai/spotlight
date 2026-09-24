import type { ProfileKey } from '@work/domain/value-objects/profile-key.vo';

export const PERMISSION_KINDS = ['read', 'edit', 'execute'] as const;

export type PermissionKind = (typeof PERMISSION_KINDS)[number];

export type PermissionDecision = 'allow' | 'ask' | 'deny';

export interface PermissionRuleParts {
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

export interface HarnessSettings {
  readonly rules: readonly PermissionRuleParts[];
  readonly mcpServers: readonly McpServerParts[];
  readonly native: Readonly<Record<string, unknown>>;
}

export interface ReadyProfile extends HarnessSettings {
  readonly key: ProfileKey;
}
