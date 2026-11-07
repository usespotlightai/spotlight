import type { CauseLink } from '@integrations/domain/value-objects/causal-chain.vo';
import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const CauseLinks = {
  change(input: {
    on: HookEventName;
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

  callback(hook: HookKey, taskId: TaskId): CauseLink {
    return {
      kind: 'callback',
      key: `callback:${hook.value}:${taskId.value}`,
      description: `a note by callback from the hook ${hook.value}`,
    };
  },

  delivery(integration: IntegrationKey): CauseLink {
    return {
      kind: 'delivery',
      key: `delivery:${integration.value}`,
      description: `a delivery from ${integration.value}`,
    };
  },
};
