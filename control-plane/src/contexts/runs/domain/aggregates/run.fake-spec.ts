import type {
  RunClaimer,
  RunOrdered,
} from '@runs/domain/aggregates/run.aggregate';
import { RunPolicy } from '@runs/domain/value-objects/run-policy.vo';
import { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import {
  RunWorkspace,
  WorkspaceKey,
} from '@runs/domain/value-objects/workspace-key.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

type Ordering = Pick<RunOrdered, 'requester' | 'policy' | 'workspace'> & {
  readonly now: Date;
};

export const ORDERED_AT = new Date('2026-01-01T00:00:00.000Z');

const TEAM = TeamId.of('team_1');

export const TURN_POLICY = RunPolicy.of({
  holdsTurn: true,
  gated: true,
  actsBeyondItself: true,
  asks: 'requester',
  listed: true,
  exclusive: true,
});

export const CONVERSATION_POLICY = RunPolicy.of({
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
  holdingTurn(
    id = 'subject_1',
    revision = 0,
    team: TeamId = TEAM,
    owner = 'requester',
    kind = 'subject',
  ): Ordering {
    return {
      requester: RunRequester.of({
        owner,
        kind,
        id,
        token: String(revision),
        team,
      }),
      policy: TURN_POLICY,
      now: ORDERED_AT,
      workspace: RunWorkspace.of({
        key: WorkspaceKey.of(owner, `${kind}-${id}`),
        rejoinable: true,
        restores: 'always',
      }),
    };
  },

  conversing(
    id = 'conversation_1',
    team: TeamId = TEAM,
    owner = 'requester',
    kind = 'conversation',
  ): Ordering {
    return {
      requester: RunRequester.of({ owner, kind, id, team }),
      policy: CONVERSATION_POLICY,
      now: ORDERED_AT,
      workspace: RunWorkspace.of({
        key: WorkspaceKey.of(owner, `${kind}-${id}`),
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
      now: ORDERED_AT,
      workspace: key
        ? RunWorkspace.of({
            key: WorkspaceKey.of('workspace', key),
            rejoinable: false,
            restores: 'when-continuing',
          })
        : null,
    };
  },

  isolated(
    id = 'run_1',
    team: TeamId = TEAM,
    owner = 'isolated',
    kind = 'trial',
  ): Ordering {
    return {
      requester: RunRequester.of({ owner, kind, id, team }),
      policy: ISOLATED_POLICY,
      now: ORDERED_AT,
      workspace: RunWorkspace.of({
        key: WorkspaceKey.of(owner, `${kind}-${id}`),
        rejoinable: false,
        restores: 'when-continuing',
      }),
    };
  },
};

export const claimer = (runner: RunnerId, workspace = 'ws_1'): RunClaimer => ({
  runner,
  workspaceId: WorkspaceId.of(workspace),
});
