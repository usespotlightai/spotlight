import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { ChatPush } from '@work/domain/services/chat-push';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { RefUpdate } from '@work/domain/value-objects/ref-update.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-19T09:00:00.000Z');
const LEON = UserId.of('user_leon');
const CHAT = ChatId.of('chat_1');
const MAIN = Branch.of('main');
const BRANCH = Branch.of('feat/video-icons');
const PUSHED = 'b'.repeat(40);
const GONE = '0'.repeat(40);
const REVIEW = StationId.of('station_review');
const COMPLETED = StationId.of('station_completed');

const line = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    stationOf({
      id: StationId.of('station_backlog'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: '#a3a8b0',
      kind: 'backlog',
    }),
    stationOf({
      id: REVIEW,
      key: StationKey.of('ship'),
      name: StationName.of('Ship'),
      position: 1,
      color: '#a3a8b0',
      harness: HarnessId.of('dev'),
    }),
    stationOf({
      id: COMPLETED,
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 2,
      color: '#a3a8b0',
      kind: 'completed',
    }),
  ],
});

const heldBy = (chat: ChatId) =>
  Task.openedInChat({
    defaultBranch: Branch.of('main'),
    line,
    at: REVIEW,
    title: TaskTitle.of('Show video icons'),
    description: null,
    branch: BRANCH,
    rank: TaskRank.of('i'),
    by: LEON,
    members: TeamMembers.of([LEON]),
    chat,
    hold: HoldId.of('hold_1'),
    now: NOW,
    newId: () => 'task_1',
  });

const handedToTheLine = () =>
  heldBy(CHAT).resumeLine({
    by: LEON,
    line,
    next: 'continue',
    to: null,
    rank: null,
    verdict: null,
    summary: null,
    turnHeads: [],
    at: NOW,
  });

const completed = () =>
  heldBy(CHAT).moveTo(
    line,
    COMPLETED,
    TaskRank.of('m'),
    {
      line,
      body: TaskNoteBody.of('Done.'),
      at: NOW,
      voice: Voice.person(LEON),
    },
    { mover: LEON },
  );

const refusal = (ref: string, owner: Task | null = null, to: string = PUSHED) =>
  ChatPush.refusal({
    chat: CHAT,
    update: RefUpdate.of({ ref, from: 'a'.repeat(40), to }),
    defaultBranch: MAIN,
    owner,
  });

describe('ChatPush, which branches a chat may push', () => {
  it('lets a chat push a new branch', () => {
    expect(refusal('refs/heads/fix/icons')).toBeNull();
  });

  it('lets a chat push the branch of the task it holds', () => {
    expect(refusal(`refs/heads/${BRANCH.value}`, heldBy(CHAT))).toBeNull();
  });

  it('refuses the default branch', () => {
    expect(refusal('refs/heads/main')).toEqual({
      kind: 'push-to-default-branch',
      branch: MAIN,
    });
  });

  it('refuses a tag, which is not a branch', () => {
    expect(refusal('refs/tags/v1')).toEqual({
      kind: 'push-not-to-a-branch',
      ref: 'refs/tags/v1',
    });
  });

  it('refuses to delete a branch', () => {
    expect(refusal('refs/heads/fix/icons', null, GONE)).toEqual({
      kind: 'push-deletes-a-branch',
      branch: Branch.of('fix/icons'),
    });
  });

  it('refuses the branch of a task another chat holds', () => {
    expect(
      refusal(`refs/heads/${BRANCH.value}`, heldBy(ChatId.of('chat_2'))),
    ).toEqual({ kind: 'branch-of-another-task', branch: BRANCH });
  });

  it('refuses the branch of its task after the person handed it to the line', () => {
    expect(refusal(`refs/heads/${BRANCH.value}`, handedToTheLine())).toEqual({
      kind: 'branch-of-released-task',
      branch: BRANCH,
      completed: false,
    });
  });

  it('refuses the branch of its task after the task completed', () => {
    expect(refusal(`refs/heads/${BRANCH.value}`, completed())).toEqual({
      kind: 'branch-of-released-task',
      branch: BRANCH,
      completed: true,
    });
  });
});
