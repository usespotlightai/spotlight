import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ResolveConversationHandler } from '@work/application/commands/handlers/resolve-conversation.handler';
import { ResolveConversationCommand } from '@work/application/commands/resolve-conversation.command';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { ConversationLoader } from '@work/application/services/conversation-loader.service';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { AssignedToAnotherPersonError } from '@work/domain/exceptions/assigned-to-another-person.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-20T12:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
const OPENER = UserId.of('user_1');
const ASKED = UserId.of('user_2');

const line = () =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      stationOf({
        id: StationId.of('station_0'),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of('station_1'),
        key: StationKey.of('triage'),
        name: StationName.of('Triage'),
        position: 1,
        color: '#a3a8b0',
        harness: HarnessId.of('dev'),
      }),
      stationOf({
        id: StationId.of('station_2'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 2,
        color: '#a3a8b0',
        kind: 'completed',
      }),
    ],
  });

const askingAndUnassigned = () =>
  Task.add({
    line: line(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: OPENER,
    now: NOW,
    newId: () => 'task_1',
  })
    .assignRun(RunId.of('run_1'), line())
    .clearFor(
      ApprovalSubject.toolCall(
        ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
      ),
      ApprovalNeeded.of('linear.comment', 'It posts publicly.', ASKED),
      {
        voice: Voice.station(RunId.of('run_1')),
        line: null,
        body: TaskNoteBody.of('Approve linear.comment?'),
        at: NOW,
      },
      RunId.of('run_1'),
      null,
    )
    .task.unassign();

let saved: Task | undefined;

const tasks = (found: Task) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (each: Task) => {
      saved = each;
    }),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    placementsAt: vi.fn(async () => []),
    findByCorrelation: vi.fn(async () => [found]),
    owningPullRequest: vi.fn(async () => null),
    reviewingPullRequest: vi.fn(async () => null),
    holdingMark: vi.fn(async () => []),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
    withTurnAnsweredBetween: vi.fn(async () => []),
    awaitingConnection: vi.fn(async () => []),
    onBranch: vi.fn(async () => null),
  }) satisfies TaskRepository & TaskPlacementsPort;

const lines = () =>
  ({
    find: vi.fn(async () => line()),
    findByStation: vi.fn(async () => line()),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
    candidate: vi.fn(),
  }) satisfies LineMapsPort;

const resolve = (found: Task, by: UserId, members: readonly UserId[]) => {
  const access = workAccessSeeing(() => true, { members });

  return new ResolveConversationHandler(
    new ConversationLoader(tasks(found), lines(), access),
    tasks(found),
    clock,
  ).execute(
    new ResolveConversationCommand(
      `task_1:${found.openConversation?.from.value ?? 0}`,
      by.value,
    ),
  );
};

describe('ResolveConversation', () => {
  beforeEach(() => {
    saved = undefined;
  });

  it('refuses the person an ask names who has not joined the team, though they may answer it', async () => {
    const task = askingAndUnassigned();

    expect(
      task.conversationStandingOf({
        person: ASKED,
        onTeam: false,
        actsOnTasks: true,
      }),
    ).toBe('asked');
    await expect(resolve(task, ASKED, [OPENER])).rejects.toMatchObject({
      refusal: expect.any(AssignedToAnotherPersonError) as unknown,
    });
    expect(saved).toBeUndefined();
  });

  it('lets the person an ask names resolve it once they joined the team, and assigns them', async () => {
    await resolve(askingAndUnassigned(), ASKED, [OPENER, ASKED]);

    expect(saved?.assignee).toEqual(ASKED);
    expect(saved?.openConversation).toBeNull();
  });
});
