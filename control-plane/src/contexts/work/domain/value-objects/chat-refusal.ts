import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

export type ChatRefusal =
  | { readonly kind: 'approval-needs-a-task'; readonly tool: Tool }
  | {
      readonly kind: 'connection-needs-a-task';
      readonly providedBy: string;
    };
