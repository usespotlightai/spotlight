import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { CauseLink } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const CauseLinks = {
  change(input: {
    on: string;
    taskId: TaskId;
    change: string;
    taskTitle: string;
  }): CauseLink {
    return {
      kind: 'event',
      key: `${input.on}:${input.taskId.value}:${input.change}`,
      description: `${input.on} of ${input.taskTitle}${input.change ? ` (${input.change})` : ''}`,
    };
  },

  hookFiring(
    hook: { readonly id: HookDefinitionId; readonly key: HookKey },
    change: CauseLink,
  ): CauseLink {
    return {
      kind: 'hook',
      key: `hook:${hook.id.value}:${change.key}`,
      description: `the hook ${hook.key.value}`,
    };
  },

  toolUsed(tool: string, occurrence: string): string {
    return `${tool} ${occurrence}`;
  },

  delivery(integration: string): CauseLink {
    return {
      kind: 'delivery',
      key: `delivery:${integration}`,
      description: `a delivery from ${integration}`,
    };
  },
};
