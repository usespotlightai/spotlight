import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { AnswerInboxItemCommand } from '@work/application/commands/answer-inbox-item.command';
import { AnswerInboxItemHandler } from '@work/application/commands/handlers/answer-inbox-item.handler';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { ConversationLoader } from '@work/application/services/conversation-loader.service';
import { DraftSending } from '@work/application/services/draft-sending.service';
import { FilesLoader } from '@work/application/services/files-loader.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { TaskDraftRepository } from '@work/domain/repositories/task-draft.repository';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
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
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-29T12:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
const transaction: TransactionPort = { inTransaction: async (work) => work() };

const line = () =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      Station.of({
        id: StationId.of('station_0'),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_1'),
        key: StationKey.of('triage'),
        name: StationName.of('Triage'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        harness: HarnessId.of('dev'),
      }),
      Station.of({
        id: StationId.of('station_2'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 2,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const waiting = () =>
  Task.add({
    line: line(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).askedAbout(
    {
      voice: Voice.station(),
      station: StationName.of('Triage'),
      body: TaskNoteBody.of('Which queue should I drain?'),
      at: NOW,
    },
    null,
  );

const NEEDS_APPROVAL = ApprovalNeeded.of(
  'linear.comment',
  'It posts publicly, under the team’s name.',
);

const asking = () =>
  Task.add({
    line: line(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  })
    .assignRun(RunId.of('run_1'), line())
    .clearFor(
      ApprovalSubject.toolCall(
        ToolCall.of(
          Tool.of('linear.comment'),
          ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
        ),
      ),
      NEEDS_APPROVAL,
      {
        voice: Voice.station(RunId.of('run_1')),
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('Approve linear.comment?'),
        at: NOW,
      },
      RunId.of('run_1'),
      null,
    ).task;

let saved: Task | undefined;

const tasks = (found: Task) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (each: Task) => {
      saved = each;
    }),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    allAtStation: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    findByMarks: vi.fn(async () => found),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
    awaitingConnection: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => line()),
    findByStation: vi.fn(async () => line()),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
  }) satisfies LineRepository;

const dispatch: TaskDispatching = {
  runIdFor: async () => RunId.of('run_2'),
};

const store = {
  grant: vi.fn(),
  received: vi.fn(async (_at, ids: readonly AttachmentId[]) =>
    ids.map((id) =>
      Attachment.of({
        id: id.value,
        name: 'queue.png',
        contentType: 'image/png',
        size: 4096,
      }),
    ),
  ),
  save: vi.fn(),
  taken: vi.fn(),
  link: vi.fn(),
  open: vi.fn(),
} satisfies AttachmentStorePort;

const files = new FilesLoader(store);

const drafts: TaskDraftRepository = {
  find: async () => null,
  save: async () => undefined,
};

const sending = new DraftSending(
  drafts,
  { mayView: async () => true } as unknown as WorkspaceAccessPort,
  {
    writers: async () => [UserId.of('user_2')],
    sent: async () => undefined,
  },
  { warn: () => undefined } as unknown as LoggerPort,
);

const answer = (
  found: Task,
  command = new AnswerInboxItemCommand('task_1:0', 'user_1', 'Cap it at 500.'),
) =>
  new AnswerInboxItemHandler(
    new ConversationLoader(tasks(found), lines()),
    tasks(found),
    dispatch,
    transaction,
    clock,
    files,
    sending,
  ).execute(command);

describe('AnswerInboxItem', () => {
  beforeEach(() => {
    saved = undefined;
  });

  it('adds the answer of the person to the trail, in their name', async () => {
    await answer(waiting());

    const last = saved?.notes[saved.notes.length - 1];
    expect(last?.body.value).toBe('Cap it at 500.');
    expect(last?.voice.author?.value).toBe('user_1');
    expect(last?.station.value).toBe('Triage');
  });

  it('names the people who wrote the answer with the person it was put to', async () => {
    await answer(
      waiting(),
      new AnswerInboxItemCommand(
        'task_1:0',
        'user_1',
        'Cap it at 500.',
        [],
        null,
        null,
        ['user_2'],
      ),
    );

    const last = saved?.notes[saved.notes.length - 1];
    expect(last?.voice.coAuthors.map((each) => each.value)).toEqual(['user_2']);
  });

  it('takes files alone as an answer, naming them in the trail', async () => {
    await answer(
      waiting(),
      new AnswerInboxItemCommand('task_1:0', 'user_1', '  ', ['file_1']),
    );

    const last = saved?.notes[saved.notes.length - 1];
    expect(last?.body.value).toBe('Attached queue.png.');
    expect(last?.attachments.map((each) => each.id.value)).toEqual(['file_1']);
    expect(store.taken).toHaveBeenCalledWith(
      saved?.workspaceId,
      last?.attachments,
    );
  });

  it('stops the task waiting and puts it back to work', async () => {
    await answer(waiting());

    expect(saved?.awaitingReview).toBe(false);
    expect(saved?.currentRunId).toEqual(RunId.of('run_2'));
  });

  it('starts nothing where a run is already working it', async () => {
    await answer(
      Task.rehydrate({ ...waiting(), currentRunId: RunId.of('run_1') }),
    );

    expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
  });

  it('does not answer a task nobody was asked about', async () => {
    const untouched = Task.add({
      line: line(),
      at: StationId.of('station_1'),
      title: TaskTitle.of('Fix the queue'),
      rank: TaskRank.of('i'),
      createdBy: UserId.of('user_1'),
      now: NOW,
      newId: () => 'task_1',
    });

    await expect(answer(untouched)).rejects.toThrow();
    expect(saved).toBeUndefined();
  });

  it('grants the approval a person gives, leaving the task to the run that asked', async () => {
    await answer(
      asking(),
      new AnswerInboxItemCommand('task_1:0', 'user_1', '', [], 'approved'),
    );

    const decided = saved?.notes.find((note) => note.approval)?.approval;
    expect(decided?.status).toBe('approved');
    expect(decided?.decided?.by.value).toBe('user_1');
    expect(saved?.notes[saved.notes.length - 1]?.body.value).toBe('Approved.');
    expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
  });

  it('grants it with the person’s changes, telling the agent what it runs with instead', async () => {
    await answer(
      asking(),
      new AnswerInboxItemCommand('task_1:0', 'user_1', '', [], 'approved', {
        issue: 'ENG-12',
        body: 'Fixed in #41.',
      }),
    );

    const decided = saved?.notes.find((note) => note.approval)?.approval;
    expect(decided?.edited?.inputs.values).toEqual({
      issue: 'ENG-12',
      body: 'Fixed in #41.',
    });
    expect(saved?.notes[saved.notes.length - 1]?.body.value).toBe(
      [
        'Approved.',
        'I changed what it runs with. Call it again as before and it runs with these instead:',
        'body: `Fixed in #41.`',
        'issue: `ENG-12`',
      ].join('\n\n'),
    );
  });

  it('tells the agent what changed after the person’s own words', async () => {
    await answer(
      asking(),
      new AnswerInboxItemCommand(
        'task_1:0',
        'user_1',
        'Mention the PR.',
        [],
        'approved',
        { issue: 'ENG-12', body: 'Fixed in #41.' },
      ),
    );

    expect(saved?.notes[saved.notes.length - 1]?.body.value).toMatch(
      /^Mention the PR\.\n\nI changed what it runs with\./,
    );
  });

  it('rejects changes to a dismissed request, saving nothing', async () => {
    await expect(
      answer(
        asking(),
        new AnswerInboxItemCommand('task_1:0', 'user_1', '', [], 'dismissed', {
          issue: 'ENG-12',
          body: 'Fixed in #41.',
        }),
      ),
    ).rejects.toThrow(/A dismissed request cannot run with changes/);
    expect(saved).toBeUndefined();
  });

  it('says plainly it was approved where the changes left it as it was', async () => {
    await answer(
      asking(),
      new AnswerInboxItemCommand('task_1:0', 'user_1', '', [], 'approved', {
        issue: 'ENG-12',
        body: 'Fixed.',
      }),
    );

    expect(saved?.notes[saved.notes.length - 1]?.body.value).toBe('Approved.');
  });

  it('tells the agent it was dismissed where the person gave no reason', async () => {
    await answer(
      asking(),
      new AnswerInboxItemCommand('task_1:0', 'user_1', '', [], 'dismissed'),
    );

    expect(saved?.notes[saved.notes.length - 1]?.body.value).toBe('Dismissed.');
  });

  it('records a dismissal in the person’s own words', async () => {
    await answer(
      asking(),
      new AnswerInboxItemCommand(
        'task_1:0',
        'user_1',
        'Not before the release.',
        [],
        'dismissed',
      ),
    );

    expect(saved?.notes.find((note) => note.approval)?.approval?.status).toBe(
      'dismissed',
    );
    expect(saved?.notes[saved.notes.length - 1]?.body.value).toBe(
      'Not before the release.',
    );
  });

  it('takes words alone like any answer, leaving the tool call undecided', async () => {
    await answer(
      asking(),
      new AnswerInboxItemCommand(
        'task_1:0',
        'user_1',
        'Mention the ticket too.',
      ),
    );

    expect(saved?.notes.find((note) => note.approval)?.approval?.status).toBe(
      'pending',
    );
    expect(saved?.notes[saved.notes.length - 1]?.body.value).toBe(
      'Mention the ticket too.',
    );
    expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
  });

  describe('answering a run that waits for the person', () => {
    it('says the task was answered for its run, leaving the answer for that run to be given', async () => {
      await answer(asking());

      expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
      expect(saved?.unacknowledged.map((each) => each.body.value)).toEqual([
        'Cap it at 500.',
      ]);
      expect(saved?.pullEvents()).toContainEqual(
        new TaskAnswered(
          TaskId.of('task_1'),
          WorkspaceId.of('ws_1'),
          RunId.of('run_1'),
        ),
      );
    });

    it('hands the answer to a new run in its briefing, so the run never gets it twice', async () => {
      await answer(waiting());

      expect(saved?.unacknowledged).toEqual([]);
      expect(
        saved?.pullEvents().some((each) => each instanceof TaskAnswered),
      ).toBe(false);
    });
  });

  it('rejects a decision where nothing was put up to be approved', async () => {
    await expect(
      answer(
        waiting(),
        new AnswerInboxItemCommand('task_1:0', 'user_1', '', [], 'approved'),
      ),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });
});
