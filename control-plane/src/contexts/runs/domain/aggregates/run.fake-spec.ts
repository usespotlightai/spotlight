import type { RunOrdered } from '@runs/domain/aggregates/run.aggregate';
import { RunPolicy } from '@runs/domain/value-objects/run-policy.vo';
import { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import {
  RunWorkspace,
  WorkspaceKey,
} from '@runs/domain/value-objects/workspace-key.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

type Ordering = Pick<RunOrdered, 'requester' | 'policy' | 'workspace'>;

const TEAM = TeamId.of('team_1');

export const TASK_POLICY = RunPolicy.of({
  holdsTurn: true,
  gated: true,
  actsBeyondItself: true,
  asks: 'requester',
  listed: true,
  exclusive: true,
});

export const CHAT_POLICY = RunPolicy.of({
  holdsTurn: false,
  gated: false,
  actsBeyondItself: true,
  asks: 'requester',
  listed: true,
  exclusive: true,
});

export const ISOLATED_POLICY = RunPolicy.of({
  holdsTurn: false,
  gated: false,
  actsBeyondItself: false,
  asks: 'recorded',
  listed: false,
  exclusive: false,
});

export const SPEC_POLICY = RunPolicy.of({
  holdsTurn: false,
  gated: false,
  actsBeyondItself: true,
  asks: 'requester',
  listed: true,
  exclusive: false,
});

export const orderedFor = {
  task(taskId = 'task_1', revision = 0, team: TeamId = TEAM): Ordering {
    return {
      requester: RunRequester.of({
        owner: 'work',
        kind: 'task',
        id: taskId,
        token: String(revision),
        team,
      }),
      policy: TASK_POLICY,
      workspace: RunWorkspace.of({
        key: WorkspaceKey.of('work', `task-${taskId}`),
        rejoinable: true,
        restores: 'always',
      }),
    };
  },

  chat(chatId = 'chat_1', team: TeamId = TEAM): Ordering {
    return {
      requester: RunRequester.of({
        owner: 'work',
        kind: 'chat',
        id: chatId,
        team,
      }),
      policy: CHAT_POLICY,
      workspace: RunWorkspace.of({
        key: WorkspaceKey.of('work', `chat-${chatId}`),
        rejoinable: true,
        restores: 'when-continuing',
      }),
    };
  },

  spec(runId = 'run_1', key: string | null = null): Ordering {
    return {
      requester: RunRequester.of({
        owner: 'workspace',
        kind: 'spec',
        id: runId,
        team: null,
      }),
      policy: SPEC_POLICY,
      workspace: key
        ? RunWorkspace.of({
            key: WorkspaceKey.of('workspace', key),
            rejoinable: false,
            restores: 'when-continuing',
          })
        : null,
    };
  },

  isolated(kind = 'replay', id = 'run_1', team: TeamId = TEAM): Ordering {
    return {
      requester: RunRequester.of({ owner: 'replays', kind, id, team }),
      policy: ISOLATED_POLICY,
      workspace: RunWorkspace.of({
        key: WorkspaceKey.of('replays', `${kind}-${id}`),
        rejoinable: false,
        restores: 'when-continuing',
      }),
    };
  },
};
