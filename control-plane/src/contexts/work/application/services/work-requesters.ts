import {
  type RunPolicyContract,
  type RunRequesterContract,
  type RunWorkingCopyContract,
  workingCopyKeyOf,
} from '@runs/application/contracts/run-order.contract';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';

const OWNER = 'work';

export type WorkRequest =
  | { readonly task: TaskId; readonly revision: TaskRevision }
  | { readonly chat: ChatId };

export interface RequesterRef {
  readonly owner: string;
  readonly kind: string;
  readonly id: string;
  readonly token: string | null;
}

const TASK_POLICY: RunPolicyContract = {
  holdsTurn: true,
  gated: true,
  actsBeyondItself: true,
  asks: 'requester',
  listed: true,
  exclusive: true,
};

const CHAT_POLICY: RunPolicyContract = {
  holdsTurn: false,
  gated: false,
  actsBeyondItself: true,
  asks: 'requester',
  listed: true,
  exclusive: true,
};

const revisionIn = (token: string | null): TaskRevision | null => {
  const value = token === null ? Number.NaN : Number(token);

  return Number.isInteger(value) && value >= 0 ? TaskRevision.of(value) : null;
};

export const WorkRequesters = {
  owner: OWNER,

  task(
    taskId: TaskId,
    revision: TaskRevision,
    team: TeamId,
  ): RunRequesterContract {
    return {
      owner: OWNER,
      kind: 'task',
      id: taskId.value,
      token: String(revision.value),
      team: team.value,
    };
  },

  chat(chatId: ChatId, team: TeamId): RunRequesterContract {
    return {
      owner: OWNER,
      kind: 'chat',
      id: chatId.value,
      token: null,
      team: team.value,
    };
  },

  taskPolicy: TASK_POLICY,

  chatPolicy: CHAT_POLICY,

  taskWorkingCopyKey(taskId: TaskId): string {
    return workingCopyKeyOf(OWNER, `task-${taskId.value}`);
  },

  chatWorkingCopyKey(chatId: ChatId): string {
    return workingCopyKeyOf(OWNER, `chat-${chatId.value}`);
  },

  taskWorkingCopy(taskId: TaskId): RunWorkingCopyContract {
    return {
      key: WorkRequesters.taskWorkingCopyKey(taskId),
      rejoinable: true,
      restores: 'always',
    };
  },

  chatWorkingCopy(chatId: ChatId): RunWorkingCopyContract {
    return {
      key: WorkRequesters.chatWorkingCopyKey(chatId),
      rejoinable: true,
      restores: 'when-continuing',
    };
  },

  heldBy(name: string): { task: TaskId } | { chat: ChatId } | null {
    const [, kind, id] = /^(task|chat)-(.+)$/.exec(name) ?? [];

    if (!id) {
      return null;
    }

    return kind === 'task' ? { task: TaskId.of(id) } : { chat: ChatId.of(id) };
  },

  decode(requester: RequesterRef): WorkRequest | null {
    if (requester.owner !== OWNER) {
      return null;
    }

    if (requester.kind === 'task') {
      const revision = revisionIn(requester.token);

      return revision ? { task: TaskId.of(requester.id), revision } : null;
    }

    return requester.kind === 'chat' ? { chat: ChatId.of(requester.id) } : null;
  },

  taskOf(requester: RequesterRef): TaskId | null {
    const decoded = WorkRequesters.decode(requester);

    return decoded && 'task' in decoded ? decoded.task : null;
  },

  chatOf(requester: RequesterRef): ChatId | null {
    const decoded = WorkRequesters.decode(requester);

    return decoded && 'chat' in decoded ? decoded.chat : null;
  },
};
