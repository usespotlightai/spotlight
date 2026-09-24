import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import type { Clearance } from '@work/domain/value-objects/clearance';
import { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-18T10:00:00.000Z');
const RUN = RunId.of('run_1');
const IMPLEMENTATION = StationId.of('station_implementation');
const REVIEW = StationId.of('station_review');

const station = (
  id: StationId,
  key: string,
  position: number,
  kind: 'backlog' | 'work' | 'completed' = 'work',
) =>
  Station.of({
    id,
    key: StationKey.of(key),
    name: StationName.of(key),
    position,
    color: StationColor.plain(),
    kind,
  });

const line = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station(StationId.of('station_backlog'), 'backlog', 0, 'backlog'),
    station(IMPLEMENTATION, 'implementation', 1),
    station(REVIEW, 'code-review', 2),
    station(StationId.of('station_completed'), 'completed', 3, 'completed'),
  ],
});

const NEEDED = ApprovalNeeded.of('linear.comment', 'It posts publicly.');
const CALL = ApprovalSubject.toolCall(
  ToolCall.of(
    Tool.of('linear.comment'),
    ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
  ),
);

const asking = (body = 'Approve linear.comment?') => ({
  station: StationName.of('implementation'),
  body: TaskNoteBody.of(body),
  at: NOW,
  voice: Voice.station(RUN),
});

const person = (body: string, who = 'user_1') => ({
  station: StationName.of('implementation'),
  body: TaskNoteBody.of(body),
  at: NOW,
  voice: Voice.person(UserId.of(who)),
});

const heldAt = (task: Task, at: StationId = task.stationId): Task =>
  Task.rehydrate({ ...task, stationId: at, currentRunId: RUN });

const working = () =>
  heldAt(
    Task.add({
      line,
      at: IMPLEMENTATION,
      title: TaskTitle.of('Tell the reporter'),
      rank: TaskRank.of('i'),
      now: NOW,
      newId: () => 'task_1',
    }),
  );

const clear = (task: Task, call: ApprovalSubject = CALL) =>
  task.clearFor(call, NEEDED, asking(), RUN);

const askedOnce = () => {
  const asked = clear(working()).task;
  const at = asked.approvalFor(CALL)?.at;

  if (!at) {
    throw new Error('nothing was asked');
  }

  return { asked, at };
};

const decided = (
  decision: 'granted' | 'refused',
  words = decision === 'granted' ? 'Approved.' : 'Rejected.',
) => {
  const { asked, at } = askedOnce();

  return { task: asked.answered(at, person(words), decision), at };
};

const kindOf = (clearance: Clearance) => clearance.kind;

describe('clearing a tool call that needs approval', () => {
  it('asks the person, at the station the run stands at, and lets go of the run', () => {
    const { task, clearance } = clear(working());
    const standing = task.approvalFor(CALL);

    expect(kindOf(clearance)).toBe('asked');
    expect(standing?.approval.open).toBe(true);
    expect(standing?.approval.at.equals(IMPLEMENTATION)).toBe(true);
    expect(task.awaitingReview).toBe(true);
    expect(task.running).toBe(false);
  });

  it('claims a grant as it gives it, so a second call finds nothing to use', () => {
    const { task } = decided('granted');
    const first = clear(heldAt(task));
    const second = clear(heldAt(first.task));

    expect(kindOf(first.clearance)).toBe('given');
    expect(first.task.approvalFor(CALL)?.approval.spent).toBe(true);
    expect(kindOf(second.clearance)).toBe('asked');
  });

  it('hands a claimed grant back, so a call that failed can be tried again', () => {
    const { task, at } = decided('granted');
    const claimed = clear(heldAt(task)).task;

    const returned = heldAt(claimed.approvalReturned(at));

    expect(returned.approvalFor(CALL)?.approval.grants).toBe(true);
    expect(kindOf(clear(returned).clearance)).toBe('given');
  });

  it('refuses a rejected call with the person’s own reason, and asks nothing', () => {
    const { task } = decided('refused', 'Not before the release.');
    const { task: after, clearance } = clear(heldAt(task));

    expect(clearance).toEqual({
      kind: 'refused',
      reason: 'Not before the release.',
    });
    expect(after.notes).toHaveLength(task.notes.length);
  });

  it('asks again at another station, where a grant from the last one does not reach', () => {
    const { task } = decided('granted');

    expect(kindOf(clear(heldAt(task, REVIEW)).clearance)).toBe('asked');
  });

  it('asks again at another station, where a rejection from the last one does not reach', () => {
    const { task } = decided('refused');

    expect(kindOf(clear(heldAt(task, REVIEW)).clearance)).toBe('asked');
  });

  it('asks again where the call would send something else', () => {
    const { task } = decided('granted');
    const other = ApprovalSubject.toolCall(
      ToolCall.of(
        Tool.of('linear.comment'),
        ToolInputs.of({ issue: 'ENG-12', body: 'Something else.' }),
      ),
    );

    expect(kindOf(clear(heldAt(task), other).clearance)).toBe('asked');
  });

  it('keeps a harness permission and a tool named like it apart, each way', () => {
    const permission = ApprovalSubject.harnessPermission(
      HarnessPermission.asked({
        harness: HarnessId.of('claude-code'),
        kind: 'execute',
        title: 'git push',
        input: undefined,
      }),
    );
    const lookalike = ApprovalSubject.toolCall(
      ToolCall.of(
        Tool.of('claude-code.execute'),
        ToolInputs.of({ title: 'git push' }),
      ),
    );
    const grantedFor = (subject: ApprovalSubject) => {
      const asked = clear(working(), subject).task;
      const at = asked.approvalFor(subject)?.at;

      if (!at) {
        throw new Error('nothing was asked');
      }

      return heldAt(asked.answered(at, person('Go ahead.'), 'granted'));
    };

    expect(grantedFor(permission).approvalFor(lookalike)).toBeNull();
    expect(kindOf(clear(grantedFor(permission), lookalike).clearance)).toBe(
      'asked',
    );
    expect(grantedFor(lookalike).approvalFor(permission)).toBeNull();
    expect(kindOf(clear(grantedFor(lookalike), permission).clearance)).toBe(
      'asked',
    );
    expect(kindOf(clear(grantedFor(permission), permission).clearance)).toBe(
      'given',
    );
  });

  it('refuses a run that does not hold the task', () => {
    const { task } = decided('granted');

    expect(() => clear(task)).toThrow();
  });
});

describe('deciding an approval', () => {
  it('records who decided, when, and the reason they gave', () => {
    const { task } = decided('refused', 'Not before the release.');
    const approval = task.approvalFor(CALL)?.approval;

    expect(approval?.standing).toBe('refused');
    expect(approval?.decided?.by.value).toBe('user_1');
    expect(approval?.decided?.at).toEqual(NOW);
    expect(approval?.decided?.reason).toBe('Not before the release.');
  });

  it('marks the person’s answer as the approval’s, from the aggregate itself', () => {
    const { task } = decided('granted');

    expect(task.notes[task.notes.length - 1]?.form).toBe('approval');
  });

  it('refuses a second decision as a conflict, not a fault', () => {
    const { task, at } = decided('granted');

    expect(() =>
      task.answered(at, person('Rejected.', 'user_2'), 'refused'),
    ).toThrowError(expect.objectContaining({ violation: 'conflict' }));
  });

  it('refuses a decision nobody can be named for', () => {
    const { asked, at } = askedOnce();

    expect(() =>
      asked.answered(
        at,
        {
          station: StationName.of('implementation'),
          body: TaskNoteBody.of('yes'),
          at: NOW,
          voice: Voice.world(),
        },
        'granted',
      ),
    ).toThrowError(expect.objectContaining({ violation: 'conflict' }));
  });

  it('takes words alone without deciding anything', () => {
    const { asked, at } = askedOnce();
    const answered = asked.answered(at, person('Mention the ticket.'));

    expect(answered.approvalFor(CALL)?.approval.open).toBe(true);
  });
});
