import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import type { ApprovalCheck } from '@work/domain/value-objects/approval-check';
import { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
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

const runningAt = (task: Task, at: StationId = task.stationId): Task =>
  Task.rehydrate({ ...task, stationId: at, currentRunId: RUN });

const working = () =>
  runningAt(
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
  task.clearFor(call, NEEDED, asking(), RUN, null);

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
  words = decision === 'granted' ? 'Approved.' : 'Dismissed.',
) => {
  const { asked, at } = askedOnce();

  return { task: asked.answer(at, person(words), decision), at };
};

const kindOf = (check: ApprovalCheck) => check.kind;

describe('clearing a tool call that needs approval', () => {
  it('asks the person, at the station the run is at, the run keeping the task while it waits', () => {
    const { task, check } = clear(working());
    const current = task.approvalFor(CALL);

    expect(kindOf(check)).toBe('asked');
    expect(current?.approval.open).toBe(true);
    expect(current?.approval.at.equals(IMPLEMENTATION)).toBe(true);
    expect(task.awaitingReview).toBe(true);
    expect(task.hasCurrentRun(RUN)).toBe(true);
    expect(task.working).toBe(false);
  });

  it('asks nothing more while a person still owes an answer, so the run waits for it', () => {
    const { asked } = askedOnce();
    const other = ApprovalSubject.toolCall(
      ToolCall.of(Tool.of('linear.close'), ToolInputs.of({ issue: 'ENG-12' })),
    );

    const again = clear(asked, other);

    expect(kindOf(again.check)).toBe('asked');
    expect(again.task.notes).toHaveLength(asked.notes.length);
  });

  it('keeps what the agent first said it wants to do while a person still owes an answer', () => {
    const asked = working().clearFor(
      CALL,
      NEEDED,
      asking(),
      RUN,
      ApprovalIntent.said('post the fix on ENG-12'),
    ).task;

    const again = asked.clearFor(
      CALL,
      NEEDED,
      asking(),
      RUN,
      ApprovalIntent.said('post something else'),
    ).task;

    expect(again.approvalFor(CALL)?.approval.intent?.value).toBe(
      'post the fix on ENG-12',
    );
  });

  it('claims a grant as it gives it, so a second call finds nothing to use', () => {
    const { task } = decided('granted');
    const first = clear(runningAt(task));
    const second = clear(runningAt(first.task));

    expect(kindOf(first.check)).toBe('given');
    expect(first.task.approvalFor(CALL)?.approval.spent).toBe(true);
    expect(kindOf(second.check)).toBe('asked');
  });

  it('hands a claimed grant back, so a call that failed can be tried again', () => {
    const { task, at } = decided('granted');
    const claimed = clear(runningAt(task)).task;

    const returned = runningAt(claimed.returnApproval(at));

    expect(returned.approvalFor(CALL)?.approval.grants).toBe(true);
    expect(kindOf(clear(returned).check)).toBe('given');
  });

  it('refuses a rejected call with the person’s own reason, and asks nothing', () => {
    const { task } = decided('refused', 'Not before the release.');
    const { task: after, check } = clear(runningAt(task));

    expect(check).toEqual({
      kind: 'refused',
      reason: 'Not before the release.',
    });
    expect(after.notes).toHaveLength(task.notes.length);
  });

  it('asks again at another station, where a grant from the last one does not reach', () => {
    const { task } = decided('granted');

    expect(kindOf(clear(runningAt(task, REVIEW)).check)).toBe('asked');
  });

  it('asks again at another station, where a rejection from the last one does not reach', () => {
    const { task } = decided('refused');

    expect(kindOf(clear(runningAt(task, REVIEW)).check)).toBe('asked');
  });

  it('asks again where the call would send something else', () => {
    const { task } = decided('granted');
    const other = ApprovalSubject.toolCall(
      ToolCall.of(
        Tool.of('linear.comment'),
        ToolInputs.of({ issue: 'ENG-12', body: 'Something else.' }),
      ),
    );

    expect(kindOf(clear(runningAt(task), other).check)).toBe('asked');
  });

  it('keeps a harness permission and a tool named like it apart, each way', () => {
    const permission = ApprovalSubject.harnessPermission(
      HarnessPermission.asked({
        harness: HarnessId.of('claude-code'),
        kind: 'execute',
        title: 'git push',
        input: undefined,
        tool: null,
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

      return runningAt(asked.answer(at, person('Go ahead.'), 'granted'));
    };

    expect(grantedFor(permission).approvalFor(lookalike)).toBeNull();
    expect(kindOf(clear(grantedFor(permission), lookalike).check)).toBe(
      'asked',
    );
    expect(grantedFor(lookalike).approvalFor(permission)).toBeNull();
    expect(kindOf(clear(grantedFor(lookalike), permission).check)).toBe(
      'asked',
    );
    expect(kindOf(clear(grantedFor(permission), permission).check)).toBe(
      'given',
    );
  });

  it('rejects a run that is not the current run of the task', () => {
    const { task } = decided('granted');

    expect(() => clear(task.leaveRun(RUN, NOW))).toThrow();
  });
});

describe('deciding an approval', () => {
  it('records who decided, when, and the reason they gave', () => {
    const { task } = decided('refused', 'Not before the release.');
    const approval = task.approvalFor(CALL)?.approval;

    expect(approval?.status).toBe('refused');
    expect(approval?.decided?.by.value).toBe('user_1');
    expect(approval?.decided?.at).toEqual(NOW);
    expect(approval?.decided?.reason).toBe('Not before the release.');
  });

  it('marks the person’s answer as the approval’s, from the aggregate itself', () => {
    const { task } = decided('granted');

    expect(task.notes[task.notes.length - 1]?.form).toBe('approval');
  });

  it('rejects a second decision as a conflict, not a fault', () => {
    const { task, at } = decided('granted');

    expect(() =>
      task.answer(at, person('Dismissed.', 'user_2'), 'refused'),
    ).toThrowError(expect.objectContaining({ violation: 'conflict' }));
  });

  it('lets only the person it was asked of approve it, and anyone dismiss it', () => {
    const askedOfTheTeam = clear(working()).task;
    const alice = ApprovalNeeded.of(
      'linear.comment',
      'Alice asks to approve each call made with their Linear connection.',
      UserId.of('user_alice'),
    );
    const asked = working().clearFor(CALL, alice, asking(), RUN, null).task;
    const at = asked.approvalFor(CALL)?.at;

    expect(askedOfTheTeam.approvalFor(CALL)?.approval.askedOf).toBeNull();
    expect(at && asked.approvalFor(CALL)?.approval.askedOf?.value).toBe(
      'user_alice',
    );
    if (!at) {
      throw new Error('nothing was asked');
    }

    expect(() =>
      asked.answer(at, person('Approved.', 'user_bob'), 'granted'),
    ).toThrowError(expect.objectContaining({ violation: 'conflict' }));
    expect(
      asked
        .answer(at, person('Approved.', 'user_alice'), 'granted')
        .approvalFor(CALL)?.approval.status,
    ).toBe('granted');
    expect(
      asked
        .answer(at, person('Not now.', 'user_bob'), 'refused')
        .approvalFor(CALL)?.approval.status,
    ).toBe('refused');
  });

  it('puts a call asked of one person to that person', () => {
    const alice = ApprovalNeeded.of(
      'linear.comment',
      'Alice asks to approve each call made with their Linear connection.',
      UserId.of('user_alice'),
    );

    const asked = working().clearFor(CALL, alice, asking(), RUN, null).task;

    expect(asked.assignee?.value).toBe('user_alice');
    expect(clear(working()).task.assignee).toEqual(working().assignee);
  });

  it('spends a grant on a call asked of one person only where that person gave it', () => {
    const { task } = decided('granted');
    const alice = ApprovalNeeded.of(
      'linear.comment',
      'Alice asks to approve each call made with their Linear connection.',
      UserId.of('user_alice'),
    );
    const user1 = ApprovalNeeded.of(
      'linear.comment',
      'It posts publicly.',
      UserId.of('user_1'),
    );
    const running = runningAt(task);

    const reasked = running.clearFor(CALL, alice, asking(), RUN, null);
    expect(reasked.check.kind).toBe('asked');
    expect(reasked.task.approvalFor(CALL)?.approval.askedOf?.value).toBe(
      'user_alice',
    );
    expect(running.clearFor(CALL, user1, asking(), RUN, null).check.kind).toBe(
      'given',
    );
  });

  it('rejects a decision nobody can be named for', () => {
    const { asked, at } = askedOnce();

    expect(() =>
      asked.answer(
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

  it('names the tool it decided on in the act it records, and its server when it is one', () => {
    const refusedTool = (subject: ApprovalSubject) => {
      const asked = clear(working(), subject).task;
      const at = asked.approvalFor(subject)?.at;

      if (!at) {
        throw new Error('nothing was asked');
      }

      return asked
        .answer(at, person('Dismissed.'), 'refused')
        .pullEvents()
        .find((each): each is TaskActedOn => each instanceof TaskActedOn)?.tool;
    };
    const permission = (title: string, tool: CalledTool | null) =>
      ApprovalSubject.harnessPermission(
        HarnessPermission.asked({
          harness: HarnessId.of('claude-code'),
          kind: 'other',
          title,
          input: undefined,
          tool,
        }),
      );

    expect(refusedTool(CALL)).toEqual({ tool: 'linear.comment', server: null });
    expect(
      refusedTool(
        permission(
          'mcp__sentry__resolve_issue',
          CalledTool.of({ server: 'sentry', tool: 'resolve_issue' }),
        ),
      ),
    ).toEqual({ tool: 'resolve_issue', server: 'sentry' });
    expect(refusedTool(permission('rm -rf build', null))).toEqual({
      tool: 'claude-code other',
      server: null,
    });
  });

  it('names no tool on words that decide nothing', () => {
    const { asked, at } = askedOnce();
    const acted = asked
      .answer(at, person('Mention the ticket.'))
      .pullEvents()
      .find((each): each is TaskActedOn => each instanceof TaskActedOn);

    expect(acted?.act).toBe('answered');
    expect(acted?.tool).toBeNull();
  });

  it('records approving or refusing as the act a person took', () => {
    const decidedAs = (decision: 'granted' | 'refused') => {
      const { asked, at } = askedOnce();

      return asked
        .answer(at, person('Decided.'), decision)
        .pullEvents()
        .find((each): each is TaskActedOn => each instanceof TaskActedOn);
    };

    expect(decidedAs('granted')).toMatchObject({
      act: 'approved',
    });
    expect(decidedAs('refused')).toMatchObject({
      act: 'refused',
    });
  });

  it('takes words alone without deciding anything', () => {
    const { asked, at } = askedOnce();
    const answered = asked.answer(at, person('Mention the ticket.'));

    expect(answered.approvalFor(CALL)?.approval.open).toBe(true);
  });
});

describe('approving a tool call with changes', () => {
  const edited = (edits: Readonly<Record<string, string>>) => {
    const { asked, at } = askedOnce();

    return runningAt(asked.answer(at, person('Approved.'), 'granted', edits));
  };
  const EDITED = ApprovalSubject.toolCall(
    ToolCall.of(
      Tool.of('linear.comment'),
      ToolInputs.of({ issue: 'ENG-12', body: 'Fixed in #41.' }),
    ),
  );

  it('gives the call as asked, to run with the person’s inputs instead', () => {
    const { check } = clear(edited({ issue: 'ENG-12', body: 'Fixed in #41.' }));

    expect(check.kind === 'given' && check.edited?.values).toEqual({
      issue: 'ENG-12',
      body: 'Fixed in #41.',
    });
  });

  it('gives it too where the agent calls with the inputs the person chose', () => {
    const { check } = clear(
      edited({ issue: 'ENG-12', body: 'Fixed in #41.' }),
      EDITED,
    );

    expect(kindOf(check)).toBe('given');
  });

  it('records nothing changed where the person left every input as it was', () => {
    const task = edited({ issue: 'ENG-12', body: 'Fixed.' });
    const { check } = clear(task);

    expect(task.approvalFor(CALL)?.approval.edited).toBeNull();
    expect(check.kind === 'given' && check.edited).toBeNull();
  });

  it('types each change as the input it replaces', () => {
    const asked = ApprovalSubject.toolCall(
      ToolCall.of(
        Tool.of('queue.drain'),
        ToolInputs.of({ queue: 'retries', limit: 500, dry: true }),
      ),
    );
    const task = clear(working(), asked).task;
    const at = task.approvalFor(asked)?.at;

    if (!at) {
      throw new Error('nothing was asked');
    }

    const granted = runningAt(
      task.answer(at, person('Approved.'), 'granted', {
        queue: 'retries',
        limit: '100',
        dry: 'false',
      }),
    );
    const { check } = clear(granted, asked);

    expect(check.kind === 'given' && check.edited?.values).toEqual({
      queue: 'retries',
      limit: 100,
      dry: false,
    });
  });

  it('rejects changes that name other inputs than it asked with', () => {
    const { asked, at } = askedOnce();

    expect(() =>
      asked.answer(at, person('Approved.'), 'granted', { body: 'Hi.' }),
    ).toThrowError(expect.objectContaining({ violation: 'conflict' }));
    expect(() =>
      asked.answer(at, person('Approved.'), 'granted', {
        issue: 'ENG-12',
        body: 'Hi.',
        title: 'Extra',
      }),
    ).toThrowError(expect.objectContaining({ violation: 'conflict' }));
  });

  it('rejects an input left blank, which would run with something else', () => {
    const { asked, at } = askedOnce();

    expect(() =>
      asked.answer(at, person('Approved.'), 'granted', {
        issue: 'ENG-12',
        body: '  ',
      }),
    ).toThrowError(expect.objectContaining({ violation: 'conflict' }));
  });

  it('rejects a change that is not a value of the kind asked', () => {
    const asked = ApprovalSubject.toolCall(
      ToolCall.of(Tool.of('queue.drain'), ToolInputs.of({ limit: 500 })),
    );
    const task = clear(working(), asked).task;
    const at = task.approvalFor(asked)?.at;

    if (!at) {
      throw new Error('nothing was asked');
    }

    expect(() =>
      task.answer(at, person('Approved.'), 'granted', { limit: 'lots' }),
    ).toThrowError(expect.objectContaining({ violation: 'conflict' }));
  });

  it('rejects changes to a dismissed request, or to words that decide nothing', () => {
    const { asked, at } = askedOnce();
    const edits = { issue: 'ENG-12', body: 'Hi.' };

    expect(() =>
      asked.answer(at, person('Dismissed.'), 'refused', edits),
    ).toThrowError(expect.objectContaining({ violation: 'conflict' }));
    expect(() => asked.answer(at, person('Hmm.'), null, edits)).toThrowError(
      expect.objectContaining({ violation: 'conflict' }),
    );
  });

  it('rejects changes to what a harness asked, which only takes a yes or a no', () => {
    const permission = ApprovalSubject.harnessPermission(
      HarnessPermission.asked({
        harness: HarnessId.of('claude-code'),
        kind: 'execute',
        title: 'kubectl logs api',
        input: undefined,
        tool: null,
      }),
    );
    const task = clear(working(), permission).task;
    const at = task.approvalFor(permission)?.at;

    if (!at) {
      throw new Error('nothing was asked');
    }

    expect(() =>
      task.answer(at, person('Approved.'), 'granted', {
        title: 'kubectl logs web',
      }),
    ).toThrowError(expect.objectContaining({ violation: 'conflict' }));
  });
});
