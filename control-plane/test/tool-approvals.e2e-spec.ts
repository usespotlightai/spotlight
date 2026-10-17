import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import { openTeam } from './support/team';

const NOW = new Date('2026-01-02T03:04:05.000Z');

const NEEDED = ApprovalNeeded.of(
  'linear.comment',
  'It posts publicly, under the team’s name.',
);

const CALL = ApprovalSubject.toolCall(
  ToolCall.of(
    Tool.of('linear.comment'),
    ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
  ),
);

let database: TestDatabase;
let db: DrizzleDatabase;
let tasks: DrizzleTaskRepository;

beforeAll(async () => {
  database = await openDatabase('tool_approvals');
  db = database.db;
  tasks = new DrizzleTaskRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const readBack = async (task: Task): Promise<Task> => {
  const found = await tasks.find(task.id);

  if (!found) {
    throw new Error('the task that was just saved could not be read back');
  }

  return found;
};

describe('an approval a run asked for', () => {
  const asking = async (subject: ApprovalSubject = CALL) => {
    const { list, owner } = await openTeam(
      db,
      tasks,
      `approvals-${randomUUID()}`,
    );
    const runId = RunId.of(randomUUID());

    await tasks.save(
      list.settled({
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Set up.'),
        at: NOW,
        voice: Voice.station(),
      }),
    );

    const settled = await readBack(list);

    await tasks.save(
      Task.rehydrate({ ...settled, currentRunId: runId }).clearFor(
        subject,
        NEEDED,
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approve linear.comment?'),
          at: NOW,
          voice: Voice.station(runId),
        },
        runId,
        null,
      ).task,
    );

    return { task: await readBack(settled), owner, runId };
  };

  it('is read back with the call it stands for, still open', async () => {
    const { task } = await asking();
    const standing = task.approvalFor(CALL);

    expect(standing?.approval.open).toBe(true);
    expect(standing?.approval.because).toBe(NEEDED.because);
    expect(task.awaitingReview).toBe(true);
  });

  it('is read back as a harness permission, which a tool named like it does not match', async () => {
    const permission = ApprovalSubject.harnessPermission(
      HarnessPermission.asked({
        harness: HarnessId.of('claude-code'),
        kind: 'execute',
        title: 'git push',
        input: { command: 'git push' },
        tool: null,
      }),
    );
    const { task } = await asking(permission);
    const standing = task.approvalFor(permission);

    expect(standing?.approval.subject.kind).toBe('harness-permission');
    expect(standing?.approval.subject.name).toBe('claude-code execute');
    expect(
      task.approvalFor(
        ApprovalSubject.toolCall(
          ToolCall.of(
            Tool.of('claude-code.execute'),
            ToolInputs.of({
              title: 'git push',
              input: '{"command":"git push"}',
            }),
          ),
        ),
      ),
    ).toBeNull();
  });

  it('is read back with the MCP tool a harness permission names', async () => {
    const permission = ApprovalSubject.harnessPermission(
      HarnessPermission.asked({
        harness: HarnessId.of('claude-code'),
        kind: 'other',
        title: 'mcp__linear__create_issue',
        input: { title: 'Queue stuck' },
        tool: CalledTool.of({ server: 'linear', tool: 'create_issue' }),
      }),
    );
    const { task } = await asking(permission);

    expect(task.approvalFor(permission)?.approval.subject.tool).toEqual({
      server: 'linear',
      tool: 'create_issue',
    });
  });

  it('matches nothing where the run would send something else', async () => {
    const { task } = await asking();

    expect(
      task.approvalFor(
        ApprovalSubject.toolCall(
          ToolCall.of(
            Tool.of('linear.comment'),
            ToolInputs.of({ issue: 'ENG-12', body: 'Something else.' }),
          ),
        ),
      ),
    ).toBeNull();
  });

  it('is read back granted, claimed by the call, and handed back when the call fails', async () => {
    const { task, owner, runId } = await asking();
    const at = task.approvalFor(CALL)?.at ?? NotePosition.of(0);

    await tasks.save(
      task.answer(
        at,
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approved.'),
          at: NOW,
          voice: Voice.person(owner),
        },
        'granted',
      ),
    );

    const granted = await readBack(task);
    expect(granted.approvalFor(CALL)?.approval.grants).toBe(true);
    expect(granted.approvalFor(CALL)?.approval.decided?.by.value).toBe(
      owner.value,
    );
    expect(granted.approvalFor(CALL)?.approval.decided?.reason).toBe(
      'Approved.',
    );

    const { task: claimed, check } = Task.rehydrate({
      ...granted,
      currentRunId: runId,
    }).clearFor(
      CALL,
      NEEDED,
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Approve linear.comment?'),
        at: NOW,
        voice: Voice.station(runId),
      },
      runId,
      null,
    );
    expect(check.kind).toBe('given');
    await tasks.save(claimed);

    const spent = await readBack(granted);
    expect(spent.approvalFor(CALL)?.approval.grants).toBe(false);
    expect(spent.approvalFor(CALL)?.approval.spent).toBe(true);

    await tasks.save(spent.returnApproval(at));

    expect((await readBack(granted)).approvalFor(CALL)?.approval.grants).toBe(
      true,
    );
  });

  it('lets only one of two calls racing for a grant claim it', async () => {
    const { task, owner, runId } = await asking();
    const at = task.approvalFor(CALL)?.at ?? NotePosition.of(0);

    await tasks.save(
      task.answer(
        at,
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approved.'),
          at: NOW,
          voice: Voice.person(owner),
        },
        'granted',
      ),
    );

    const claiming = async () =>
      Task.rehydrate({
        ...(await readBack(task)),
        currentRunId: runId,
      }).clearFor(
        CALL,
        NEEDED,
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approve linear.comment?'),
          at: NOW,
          voice: Voice.station(runId),
        },
        runId,
        null,
      );

    const [one, other] = await Promise.all([claiming(), claiming()]);

    expect(one.check.kind).toBe('given');
    expect(other.check.kind).toBe('given');

    await tasks.save(one.task);
    await expect(tasks.save(other.task)).rejects.toBeInstanceOf(
      TaskVersionConflictError,
    );
    expect((await readBack(task)).approvalFor(CALL)?.approval.spent).toBe(true);
  });

  it('is read back granted with the person’s changes, typed as asked', async () => {
    const { task, owner } = await asking(
      ApprovalSubject.toolCall(
        ToolCall.of(
          Tool.of('queue.drain'),
          ToolInputs.of({ queue: 'retries', limit: 500 }),
        ),
      ),
    );
    const at =
      task.notes[task.notes.length - 1]?.position ?? NotePosition.of(0);

    await tasks.save(
      task.answer(
        at,
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approved.'),
          at: NOW,
          voice: Voice.person(owner),
        },
        'granted',
        { queue: 'retries', limit: '100' },
      ),
    );

    const edited = (await readBack(task)).notes[at.value]?.approval?.edited;
    expect(edited?.tool.value).toBe('queue.drain');
    expect(edited?.inputs.values).toEqual({ queue: 'retries', limit: 100 });
  });

  it('is read back with structured inputs, and a person’s change to one of them', async () => {
    const asked = ApprovalSubject.toolCall(
      ToolCall.of(
        Tool.of('linear.issue-create'),
        ToolInputs.of({
          input: { title: 'Broken', labelIds: ['bug'], estimate: null },
        }),
      ),
    );
    const { task, owner } = await asking(asked);
    const at =
      task.notes[task.notes.length - 1]?.position ?? NotePosition.of(0);

    expect((await readBack(task)).approvalFor(asked)?.approval.open).toBe(true);

    await tasks.save(
      task.answer(
        at,
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approved, retitled.'),
          at: NOW,
          voice: Voice.person(owner),
        },
        'granted',
        { input: '{"title": "Broken queue", "labelIds": ["bug"]}' },
      ),
    );

    const edited = (await readBack(task)).notes[at.value]?.approval?.edited;
    expect(edited?.inputs.values).toEqual({
      input: { title: 'Broken queue', labelIds: ['bug'] },
    });
  });

  it('is read back with what the agent said it wants to do', async () => {
    const { list } = await openTeam(db, tasks, `approvals-${randomUUID()}`);
    const runId = RunId.of(randomUUID());

    await tasks.save(
      list.settled({
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Set up.'),
        at: NOW,
        voice: Voice.station(),
      }),
    );
    const settled = await readBack(list);

    await tasks.save(
      Task.rehydrate({ ...settled, currentRunId: runId }).clearFor(
        CALL,
        NEEDED,
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approve linear.comment?'),
          at: NOW,
          voice: Voice.station(runId),
        },
        runId,
        ApprovalIntent.said('post the fix on ENG-12'),
      ).task,
    );

    expect(
      (await readBack(settled)).approvalFor(CALL)?.approval.intent?.value,
    ).toBe('post the fix on ENG-12');
  });

  it('is read back refused, and stays refused', async () => {
    const { task, owner } = await asking();
    const at = task.approvalFor(CALL)?.at ?? NotePosition.of(0);

    await tasks.save(
      task.answer(
        at,
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Not before the release.'),
          at: NOW,
          voice: Voice.person(owner),
        },
        'refused',
      ),
    );

    const refused = await readBack(task);
    expect(refused.approvalFor(CALL)?.approval.refuses).toBe(true);
    expect(refused.approvalFor(CALL)?.approval.grants).toBe(false);
  });
});
