export type PermissionDecisionShape = 'allow' | 'ask' | 'deny';

export type PermissionKindShape = 'read' | 'edit' | 'execute';

interface PermissionRuleShape {
  readonly decision: PermissionDecisionShape;
  readonly kind: PermissionKindShape;
  readonly pattern: string | null;
}

interface McpServerShape {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

export interface HarnessProfileShape {
  readonly key: string;
  readonly rules: readonly PermissionRuleShape[];
  readonly mcpServers: readonly McpServerShape[];
  readonly native: Readonly<Record<string, unknown>>;
}

export type HarnessNote =
  | {
      readonly about: 'rule';
      readonly harness: string;
      readonly rule: PermissionRuleShape;
      readonly reason: string;
    }
  | {
      readonly about: 'native';
      readonly harness: string;
      readonly path: readonly string[];
      readonly reason: string;
    }
  | {
      readonly about: 'mcp-servers';
      readonly harness: string;
      readonly reason: string;
    };

export interface ProfileReview {
  readonly problems: readonly HarnessNote[];
  readonly warnings: readonly HarnessNote[];
}
