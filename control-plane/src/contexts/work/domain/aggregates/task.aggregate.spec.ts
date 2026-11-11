import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskPassed } from '@work/domain/events/task-passed.event';
import type { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import { DraftAlreadySentError } from '@work/domain/exceptions/draft-already-sent.error';
import { InvalidTaskRevisionError } from '@work/domain/exceptions/invalid-task-revision.error';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { MoveDeniedError } from '@work/domain/exceptions/move-denied.error';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';
import { NothingSaidError } from '@work/domain/exceptions/nothing-said.error';
import { ReopenedByNobodyError } from '@work/domain/exceptions/reopened-by-nobody.error';
import { StaleTaskRevisionError } from '@work/domain/exceptions/stale-task-revision.error';
import { TaskNotReopenableError } from '@work/domain/exceptions/task-not-reopenable.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnreviewablePullRequestError } from '@work/domain/exceptions/unreviewable-pull-request.error';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { LaterPullRequest } from '@work/domain/value-objects/later-pull-request.vo';
import {
  lineMapOf,
  routesOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const withNotes = (task: Task, ...notes: TaskNote[]) =>
  Task.rehydrate({
    revision: TaskRevision.first(),
    id: task.id,
    workspaceId: task.workspaceId,
    stationId: task.stationId,
    title: task.title,
    branch: task.branch,
    description: task.description,
    rank: task.rank,
    currentRunId: task.currentRunId,
    session: task.session,
    claimedBy: task.claimedBy,
    notes: [...task.notes, ...notes].map((each, place) =>
      TaskNote.of({ ...each, position: NotePosition.of(place) }),
    ),
    createdAt: task.createdAt,
    originStationId: task.originStationId,
    createdBy: task.createdBy,
    openedFrom: task.openedFrom,
    pullRequestLink: task.pullRequestLink,
    finishedAt: task.finishedAt,
    version: task.version,
  });

const added = (description?: TaskDescription) =>
  Task.add({
    line: LINE,
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    description,
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: new Date('2026-08-27T09:15:00.000Z'),
    newId: () => 'task_1',
  });

const NOW = new Date('2026-08-29T12:00:00.000Z');

const actsOf = (task: Task) =>
  task
    .pullEvents()
    .filter((each): each is TaskActedOn => each instanceof TaskActedOn)
    .map((each) => ({
      action: each.action,
      by: each.by.value,
      after: each.after?.value ?? null,
    }));

const station = (
  id: string,
  name: string,
  position: number,
  over: Partial<Parameters<typeof stationOf>[0]> = {},
) =>
  stationOf({
    id: StationId.of(id),
    key: StationKey.of(id.replace('_', '-')),
    name: StationName.of(name),
    position,
    color: '#a3a8b0',
    ...over,
  });

const LINE = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station('station_0', 'Backlog', 0, { kind: 'backlog' }),
    station('station_1', 'Triage', 1, {
      harness: HarnessId.of('dev'),
      routes: routesOf({
        stations: [StationId.of('station_2')],
        ends: true,
      }),
    }),
    station('station_2', 'Spec', 2, { harness: HarnessId.of('dev') }),
    station('completed_1', 'Completed', 3, { kind: 'completed' }),
  ],
});

const RUN = RunId.of('run_1');

const HERE = StationId.of('station_1');

const newNote = {
  line: null,
  body: TaskNoteBody.of('Reproduced on restart.'),
  at: NOW,
  voice: Voice.station(),
};

const lastOf = (task: Task) => task.notes[task.notes.length - 1];

describe('Task, the station a note is written at', () => {
  it('names the station the task is at, from its own line', () => {
    const noted = added().addMessage({ ...newNote, line: LINE });

    expect(lastOf(noted)?.station?.value).toBe('Triage');
    expect(lastOf(noted)?.stationId.value).toBe('station_1');
  });

  it('names no station when its line no longer has it', () => {
    expect(lastOf(added().addMessage(newNote))?.station).toBeNull();
  });
});

describe('Task', () => {
  it('is at the station it was added to', () => {
    expect(added().stationId).toEqual(StationId.of('station_1'));
  });

  it('belongs to the workspace of the line it was added to', () => {
    expect(added().workspaceId).toEqual(LINE.workspaceId);
  });

  it('will not be added at a station off its line', () => {
    expect(() =>
      Task.add({
        line: LINE,
        at: StationId.of('station_9'),
        title: TaskTitle.of('Fix the queue'),
        rank: TaskRank.of('i'),
        now: NOW,
        newId: () => 'task_1',
      }),
    ).toThrow(UnknownStationError);
  });

  it('will not be opened at the station that ends its line', () => {
    expect(() =>
      Task.add({
        line: LINE,
        at: StationId.of('completed_1'),
        title: TaskTitle.of('Fix the queue'),
        rank: TaskRank.of('i'),
        now: NOW,
        newId: () => 'task_1',
      }),
    ).toThrow(InvalidTaskTransitionError);
  });

  it('remembers it was opened by a person, or received from an integration', () => {
    expect(added().openedFrom.encoded).toBe('person');

    const received = Task.add({
      line: LINE,
      at: StationId.of('station_1'),
      title: TaskTitle.of('Fix the queue'),
      rank: TaskRank.of('i'),
      receivedFrom: Happening.of('slack.app_mention'),
      now: NOW,
      newId: () => 'task_1',
    });

    expect(received.openedFrom.integration?.value).toBe('slack');
    expect(received.pullEvents()).toContainEqual(
      expect.objectContaining({ kind: 'task.opened', fromIntegration: true }),
    );
  });

  it('is added without a description', () => {
    expect(added().description).toBeNull();
  });

  it('keeps the description it was given', () => {
    const task = added(TaskDescription.of('## Steps'));

    expect(task.description?.value).toBe('## Steps');
  });

  it('remembers when it was created', () => {
    expect(added().createdAt).toEqual(new Date('2026-08-27T09:15:00.000Z'));
  });

  it('takes an identity of its own', () => {
    expect(added().id.value).toBe('task_1');
  });

  it('is at the station it was moved to', () => {
    const moved = added().react(
      LINE,
      StationId.of('station_2'),
      TaskRank.of('m'),
      newNote,
    );

    expect(moved.stationId).toEqual(StationId.of('station_2'));
  });

  it('keeps everything else across a move', () => {
    const moved = added(TaskDescription.of('## Steps')).react(
      LINE,
      StationId.of('station_2'),
      TaskRank.of('m'),
      newNote,
    );

    expect(moved.id.value).toBe('task_1');
    expect(moved.title.value).toBe('Fix the queue');
    expect(moved.description?.value).toBe('## Steps');
  });

  it('leaves the task it was moved from where it was', () => {
    const task = added();
    task.react(LINE, StationId.of('station_2'), TaskRank.of('m'), newNote);

    expect(task.stationId).toEqual(StationId.of('station_1'));
  });

  it('takes a new place in the station it is already at', () => {
    const reordered = added().reorderTo(TaskRank.of('m'));

    expect(reordered.rank.value).toBe('m');
    expect(reordered.stationId).toEqual(StationId.of('station_1'));
  });

  it('keeps a note of what a station left behind', () => {
    const noted = withNotes(
      added(),
      TaskNote.of({
        position: NotePosition.of(0),
        voice: Voice.station(),
        station: StationName.of('Triage'),
        stationId: StationId.of('station_triage'),
        body: TaskNoteBody.of('Reproduced on restart.'),
        at: new Date('2026-08-28T10:00:00.000Z'),
        kind: 'passed',
      }),
    );

    expect(noted.notes.map((each) => each.body.value)).toEqual([
      'Reproduced on restart.',
    ]);
  });

  it('keeps its notes in the order they were left', () => {
    const noted = withNotes(
      added(),
      TaskNote.of({
        position: NotePosition.of(0),
        voice: Voice.station(),
        station: StationName.of('Triage'),
        stationId: StationId.of('station_triage'),
        body: TaskNoteBody.of('First'),
        at: new Date('2026-08-28T10:00:00.000Z'),
        kind: 'passed',
      }),
      TaskNote.of({
        position: NotePosition.of(0),
        voice: Voice.station(),
        station: StationName.of('Spec'),
        stationId: StationId.of('station_spec'),
        body: TaskNoteBody.of('Second'),
        at: new Date('2026-08-28T11:00:00.000Z'),
        kind: 'passed',
      }),
    );

    expect(noted.notes.map((each) => each.station?.value)).toEqual([
      'Triage',
      'Spec',
    ]);
  });

  it('carries the notes across a move, and records the move', () => {
    const noted = withNotes(
      added(),
      TaskNote.of({
        position: NotePosition.of(0),
        voice: Voice.station(),
        station: StationName.of('Triage'),
        stationId: StationId.of('station_triage'),
        body: TaskNoteBody.of('Reproduced.'),
        at: new Date('2026-08-28T10:00:00.000Z'),
        kind: 'passed',
      }),
    ).react(LINE, StationId.of('station_2'), TaskRank.of('m'), newNote);

    expect(noted.notes).toHaveLength(2);
    expect(noted.notes[0]?.body.value).toBe('Reproduced.');
    expect(noted.notes[1]?.kind).toBe('passed');
  });

  it('is the same task as another of the same id', () => {
    expect(added().equals(added())).toBe(true);
  });
});

describe('Task, sending a shared draft', () => {
  it('moves the draft on once it is sent with the generation it was written in', () => {
    const sent = added().sendDraft(DraftGeneration.of(0));

    expect(sent.draftGeneration).toEqual(DraftGeneration.of(1));
    expect(sent.sendDraft(null)).toBe(sent);
  });

  it('refuses a second send of the same generation', () => {
    const sent = added().sendDraft(DraftGeneration.of(0));

    expect(() => sent.sendDraft(DraftGeneration.of(0))).toThrow(
      DraftAlreadySentError,
    );
  });
});

describe('Task, holding a mark', () => {
  const THREAD = Mark.of('slack.thread', '170.9');

  it('records that it was marked, once, and knows since when', () => {
    const marked = added().markedBy(THREAD, NOW);
    const again = marked.markedBy(THREAD, new Date('2026-12-01T00:00:00.000Z'));

    expect(marked.holdsMark(THREAD)?.since).toEqual(NOW);
    expect(again).toBe(marked);
    expect(
      marked.pullEvents().filter((each) => each.kind === 'task.marked'),
    ).toHaveLength(1);
  });

  it('lets a mark go', () => {
    expect(added().markedBy(THREAD, NOW).releaseMark(THREAD).marks).toEqual([]);
  });
});

describe('Task, reopened by a word', () => {
  const MENTIONED = Happening.of('slack.mention.received');
  const SENT_TO_SPEC = Happening.of('github.issue.reopened');
  const REACTING = lineMapOf({
    id: LINE.id,
    workspaceId: LINE.workspaceId,
    teamId: LINE.teamId,
    key: LINE.key,
    name: LINE.name,
    stations: LINE.stations,
    reactions: [
      Reaction.of({ happening: SENT_TO_SPEC, to: StationId.of('station_2') }),
    ],
  });
  const ADA = UserId.of('ada');
  const said = {
    ...newNote,
    voice: Voice.person(ADA),
    anchor: Anchor.of({ body: 'Look again.' }),
  };
  const ended = () =>
    added().assignRun(RUN, LINE).finishHere(RUN, LINE, newNote);

  it('reopens a finished task where it is, with the word, as a send-back', () => {
    const reopened = ended().reopen(LINE, MENTIONED, TaskRank.of('m'), said);

    expect(reopened.finished).toBe(false);
    expect(reopened.stationId).toEqual(HERE);
    expect(reopened.wantsRun(LINE)).toBe(true);
    expect(actsOf(reopened)).toContainEqual({
      action: 'sent-back',
      by: 'ada',
      after: null,
    });
  });

  it('reopens a finished task where the line reacts to what was said', () => {
    expect(ended().reopensAt(REACTING, SENT_TO_SPEC)).toEqual(
      StationId.of('station_2'),
    );
    expect(ended().reopensAt(REACTING, MENTIONED)).toEqual(HERE);
  });

  it('reopens a finished task at another station', () => {
    const reopened = ended().reopen(
      REACTING,
      SENT_TO_SPEC,
      TaskRank.of('m'),
      said,
    );

    expect(reopened.finished).toBe(false);
    expect(reopened.stationId).toEqual(StationId.of('station_2'));
  });

  it('does not reopen a task that is not finished', () => {
    expect(() =>
      added().reopen(LINE, MENTIONED, TaskRank.of('m'), said),
    ).toThrow(TaskNotReopenableError);
  });

  it('keeps a completed task finished when a person writes on it', () => {
    const completed = added().react(
      LINE,
      StationId.of('completed_1'),
      TaskRank.of('m'),
      newNote,
    );

    const written = completed.addMessage(said);

    expect(written.finished).toBe(true);
    expect(written.stationId).toEqual(StationId.of('completed_1'));
  });

  it('does not reopen a completed task', () => {
    const completed = added().react(
      LINE,
      StationId.of('completed_1'),
      TaskRank.of('m'),
      newNote,
    );

    expect(completed.reopenableOn(LINE)).toBe(false);
    expect(() =>
      completed.reopen(LINE, MENTIONED, TaskRank.of('m'), said),
    ).toThrow(TaskNotReopenableError);
  });

  it('does not take a word from the world as a reopening', () => {
    expect(() =>
      ended().reopen(LINE, MENTIONED, TaskRank.of('m'), {
        ...said,
        voice: Voice.world(),
      }),
    ).toThrow(ReopenedByNobodyError);
  });

  it('does not reopen with nothing said', () => {
    expect(() =>
      ended().reopen(LINE, MENTIONED, TaskRank.of('m'), {
        ...said,
        anchor: null,
      }),
    ).toThrow(NothingSaidError);
  });
});

describe('Task, what it is doing', () => {
  const created = () =>
    Task.add({
      line: LINE,
      at: StationId.of('station_1'),
      title: TaskTitle.of('Fix the queue'),
      rank: TaskRank.of('i'),
      createdBy: UserId.of('user_1'),
      now: new Date('2026-08-28T12:00:00.000Z'),
      newId: () => 'task_1',
    });

  const asked = () =>
    TaskNote.of({
      position: NotePosition.of(0),
      voice: Voice.station(),
      station: StationName.of('Triage'),
      stationId: StationId.of('station_triage'),
      body: TaskNoteBody.of('Which queue did you mean?'),
      at: new Date('2026-08-28T12:00:00.000Z'),
      kind: 'passed',
    });

  it('is idle when nobody has taken it up', () => {
    const task = created();

    expect(task.running).toBe(false);
    expect(task.idle).toBe(true);
  });

  it('is not idle while it has a current run', () => {
    const task = created().assignRun(RunId.of('run_1'), LINE);

    expect(task.running).toBe(true);
    expect(task.idle).toBe(false);
  });

  it('is not idle while it waits on a person', () => {
    const task = created().askedAbout({ ...asked(), line: null }, null);

    expect(task.running).toBe(false);
    expect(task.idle).toBe(false);
  });
  describe('the conversation it was worked in', () => {
    const session = HarnessSession.of('session_1');
    const runner = RunnerId.of('runner_1');

    const WORKING = RunId.of('run_working');
    const workedBy = () =>
      Task.rehydrate({ ...added(), currentRunId: WORKING });
    const sessionRecorded = () =>
      Task.rehydrate({
        ...workedBy().recordSession(WORKING, session, runner),
        currentRunId: null,
      });

    it('ignores a session reported by a run that no longer works it', () => {
      expect(
        workedBy().recordSession(RunId.of('run_gone'), session, runner).session,
      ).toBeNull();
    });

    it('is not there until a run has worked it', () => {
      expect(added().session).toBeNull();
    });

    it('is remembered once one has, with the runner that leases it', () => {
      const recorded = workedBy().recordSession(WORKING, session, runner);

      expect(recorded.session).toEqual(session);
      expect(recorded.claimedBy).toEqual(runner);
    });

    it('survives being put to a person', () => {
      const asked = sessionRecorded().askedAbout(newNote, null);

      expect(asked.session).toEqual(session);
      expect(asked.claimedBy).toEqual(runner);
      expect(asked.awaitingReview).toBe(true);
    });

    it('is left behind when the task is passed on', () => {
      const passed = sessionRecorded().react(
        LINE,
        StationId.of('station_2'),
        TaskRank.of('m'),
        newNote,
      );

      expect(passed.session).toBeNull();
      expect(passed.claimedBy).toBeNull();
    });

    it('is left behind when the task is moved by hand', () => {
      const moved = sessionRecorded().react(
        LINE,
        StationId.of('station_2'),
        TaskRank.of('m'),
        newNote,
      );

      expect(moved.session).toBeNull();
      expect(moved.claimedBy).toBeNull();
    });

    it('hands the conversation to the next run', () => {
      const carried = sessionRecorded().resume();

      expect(carried.session).toEqual(session);
    });

    it('requests no conversation when there is none to return to', () => {
      expect(added().resume().session).toBeNull();
    });

    it('survives a person answering what it was waiting on', () => {
      const answered = sessionRecorded()
        .askedAbout(newNote, null)
        .answer(NotePosition.of(0), newNote);

      expect(answered.awaitingReview).toBe(false);
      expect(answered.session).toEqual(session);
      expect(answered.claimedBy).toEqual(runner);
      expect(answered.stationId).toEqual(StationId.of('station_1'));
    });

    it('survives being reordered where it is', () => {
      const reordered = sessionRecorded().reorderTo(TaskRank.of('m'));

      expect(reordered.session).toEqual(session);
      expect(reordered.claimedBy).toEqual(runner);
      expect(reordered.stationId).toEqual(StationId.of('station_1'));
    });
  });

  describe('waiting on a person', () => {
    it('waits from the asking until they answer', () => {
      const asked = added().askedAbout(newNote, null);

      expect(asked.awaitingReview).toBe(true);
      expect(asked.answer(NotePosition.of(0), newNote).awaitingReview).toBe(
        false,
      );
    });

    it('stops waiting once the task is moved by hand', () => {
      const moved = added()
        .askedAbout(newNote, null)
        .react(LINE, StationId.of('station_2'), TaskRank.of('m'), newNote);

      expect(moved.awaitingReview).toBe(false);
    });
  });

  describe('what waits for a person', () => {
    it('waits for nobody until it is put to someone', () => {
      expect(added().openConversation).toBeNull();
    });

    it('waits for an ending once it has been put to someone', () => {
      expect(added().askedAbout(newNote, null).openConversation).toEqual({
        from: NotePosition.of(0),
        to: null,
      });
    });

    it('still waits for it after an answer', () => {
      const asked = added()
        .askedAbout(newNote, null)
        .answer(NotePosition.of(0), newNote);

      expect(asked.openConversation).not.toBeNull();
    });

    it('waits for nothing once it has moved on', () => {
      const passed = added()
        .askedAbout(newNote, null)
        .react(LINE, StationId.of('station_2'), TaskRank.of('m'), newNote);

      expect(passed.openConversation).toBeNull();
    });

    it('rejects an answer to something nobody was asked', () => {
      expect(() => added().answer(NotePosition.of(0), newNote)).toThrow(
        InvalidTaskTransitionError,
      );
    });
  });

  describe('resolving what was put to a person without an answer', () => {
    const personNote = { ...newNote, voice: Voice.person(UserId.of('user_1')) };

    it('waits for nothing once they resolve it, and notes that they did', () => {
      const resolved = added()
        .askedAbout(newNote, null)
        .resolveAt(NotePosition.of(0), newNote);

      expect(resolved.openConversation).toBeNull();
      expect(resolved.awaitingReview).toBe(false);
      expect(resolved.notes[resolved.notes.length - 1]).toMatchObject({
        kind: 'passed',
        form: 'resolved',
      });
    });

    it('opens the same conversation again on reopening, waiting on a person', () => {
      const reopened = added()
        .askedAbout(newNote, null)
        .resolveAt(NotePosition.of(0), personNote)
        .reopenAt(NotePosition.of(0), personNote);

      expect(reopened.openConversation).toEqual({
        from: NotePosition.of(0),
        to: null,
      });
      expect(reopened.awaitingReview).toBe(true);
    });

    it('rejects reopening a conversation that nobody resolved', () => {
      const passed = added()
        .askedAbout(newNote, null)
        .react(LINE, StationId.of('station_2'), TaskRank.of('m'), newNote);

      expect(() => passed.reopenAt(NotePosition.of(0), personNote)).toThrow(
        InvalidTaskTransitionError,
      );
    });

    it('rejects resolving a conversation that starts somewhere else', () => {
      const asked = added().askedAbout(newNote, null);

      expect(() => asked.resolveAt(NotePosition.of(1), newNote)).toThrow(
        InvalidTaskTransitionError,
      );
    });
  });

  describe('who it belongs to', () => {
    it('is owned by whoever created it from the start', () => {
      expect(added().assignedToThem(UserId.of('user_1'))).toBe(true);
    });

    it('falls back to the creator when a person is asked and none is set', () => {
      const asked = added().unassign().askedAbout(newNote, null);

      expect(asked.assignedToThem(UserId.of('user_1'))).toBe(true);
    });

    it('keeps the assignee it already has when a person is asked', () => {
      const asked = added()
        .assign(UserId.of('user_2'), TeamMembers.of([UserId.of('user_2')]))
        .askedAbout(newNote, null);

      expect(asked.assignedToThem(UserId.of('user_2'))).toBe(true);
      expect(asked.assignedToThem(UserId.of('user_1'))).toBe(false);
    });

    it('records a new assignee once, and nothing when it stays the same', () => {
      const members = TeamMembers.of([UserId.of('user_2')]);
      const task = added();
      task.pullEvents();
      const assigned = task.assign(UserId.of('user_2'), members);

      expect(assigned.pullEvents().map((each) => each.kind)).toEqual([
        'task.assigned',
      ]);
      expect(assigned.assign(UserId.of('user_2'), members)).toBe(assigned);
    });
  });

  describe('reading what was put to a person', () => {
    const READ = new Date('2026-08-29T12:30:00.000Z');
    const asked = () => added().askedAbout(newNote, null);

    it('leaves an ask unread until the person opens it', () => {
      expect(asked().notes[0]?.unread).toBe(true);
    });

    it('marks it read when they do', () => {
      expect(asked().read(NotePosition.of(0), READ).notes[0]?.readAt).toEqual(
        READ,
      );
    });

    it('says a conversation has something unseen, until it is read', () => {
      expect(asked().unreadFrom(NotePosition.of(0))).toBe(true);
      expect(
        asked().read(NotePosition.of(0), READ).unreadFrom(NotePosition.of(0)),
      ).toBe(false);
    });

    it('leaves what was already read when it was first read', () => {
      const read = asked().read(NotePosition.of(0), READ);

      expect(
        read.read(NotePosition.of(0), new Date('2026-08-29T13:00:00.000Z'))
          .notes[0]?.readAt,
      ).toEqual(READ);
    });

    it('reads the whole conversation, not only the note it opens with', () => {
      const carried = asked()
        .answer(NotePosition.of(0), {
          ...newNote,
          voice: Voice.person(UserId.of('user_1')),
        })
        .askedAbout(newNote, null)
        .read(NotePosition.of(0), READ);

      expect(carried.notes.map((note) => note.unread)).toEqual([
        false,
        false,
        false,
      ]);
    });

    it('is unread again when the station asks something new', () => {
      const again = asked()
        .read(NotePosition.of(0), READ)
        .answer(NotePosition.of(0), {
          ...newNote,
          voice: Voice.person(UserId.of('user_1')),
        })
        .askedAbout(newNote, null);

      expect(again.notes[2]?.unread).toBe(true);
    });

    it('will not read a conversation that does not begin there', () => {
      expect(() => asked().read(NotePosition.of(1), READ)).toThrow(
        InvalidTaskTransitionError,
      );
    });
  });

  describe('a message to the agent of the run', () => {
    const here = StationId.of('station_1');
    const aloud = {
      ...newNote,
      line: LINE,
      voice: Voice.person(UserId.of('user_1')),
    };

    it('joins the trail where the task still is', () => {
      const received = added().addMessage(aloud, here);

      expect(received.notes[0]?.kind).toBe('message');
      expect(received.notes[0]?.body.value).toBe('Reproduced on restart.');
    });

    it('waits to be acknowledged', () => {
      expect(added().addMessage(aloud, here).unacknowledged).toHaveLength(1);
    });

    it('is acknowledged once the agent has got it', () => {
      const received = added()
        .assignRun(RUN, LINE)
        .addMessage(aloud, here)
        .acknowledgeUpTo(RUN, NotePosition.of(0), NOW);

      expect(received.unacknowledged).toHaveLength(0);
    });

    it('is acknowledged only by the run that works the task', () => {
      const received = added()
        .assignRun(RUN, LINE)
        .addMessage(aloud, here)
        .acknowledgeUpTo(RunId.of('run_gone'), NotePosition.of(0), NOW);

      expect(received.unacknowledged).toHaveLength(1);
    });

    it('will not go to a station the task has left', () => {
      const moved = added().react(
        LINE,
        StationId.of('station_2'),
        TaskRank.of('m'),
        newNote,
      );

      expect(() => moved.addMessage(aloud, here)).toThrow(
        InvalidTaskTransitionError,
      );
    });

    it('leaves the notes of a station out of what is unacknowledged', () => {
      expect(added().askedAbout(newNote, null).unacknowledged).toHaveLength(0);
    });

    it('sends a task finished at a worked station back to work there when a person speaks in its run', () => {
      const finished = added()
        .assignRun(RUN, LINE)
        .finishHere(RUN, LINE, newNote);

      expect(finished.wantsRun(LINE)).toBe(false);

      const received = finished.receiveMessage(RUN, aloud, here);

      expect(received.finished).toBe(false);
      expect(received.stationId).toEqual(here);
      expect(received.wantsRun(LINE)).toBe(true);
      expect(received.unacknowledged.map((note) => note.body.value)).toEqual([
        'Reproduced on restart.',
      ]);
    });

    it('sends a task left idle at a worked station back to work when a person speaks in its last run', () => {
      const idle = added().assignRun(RUN, LINE).leaveRun(RUN, NOW);

      expect(idle.receiveMessage(RUN, aloud, here).wantsRun(LINE)).toBe(true);
    });

    it('hands the message of a person to the run still working it, wanting no second run', () => {
      const received = added()
        .assignRun(RUN, LINE)
        .receiveMessage(RUN, aloud, here);

      expect(received.hasCurrentRun(RUN)).toBe(true);
      expect(received.wantsRun(LINE)).toBe(false);
      expect(received.unacknowledged).toHaveLength(1);
    });

    it('tells that a person sent a finished task back, after the run that they sent a message in', () => {
      const received = added()
        .assignRun(RUN, LINE)
        .finishHere(RUN, LINE, newNote)
        .receiveMessage(RUN, aloud, here);

      expect(actsOf(received)).toEqual([
        { action: 'sent-back', by: 'user_1', after: 'run_1' },
      ]);
    });

    it('tells that a person answered what the task was waiting on', () => {
      const received = added()
        .askedAbout(newNote, null)
        .receiveMessage(RUN, aloud, here);

      expect(actsOf(received)).toEqual([
        { action: 'answered', by: 'user_1', after: null },
      ]);
    });

    it('tells nothing a person did when they speak to the run still working it', () => {
      expect(
        actsOf(added().assignRun(RUN, LINE).receiveMessage(RUN, aloud, here)),
      ).toEqual([]);
    });

    it('keeps a task waiting on a person when a message there is not an answer', () => {
      const asked = added().askedAbout(newNote, null);
      const received = asked.addMessage(aloud, here);

      expect(received.awaitingReview).toBe(true);
      expect(received.wantsRun(LINE)).toBe(false);
    });
  });

  describe('replying to a review comment on the pull request', () => {
    const reviewComment = {
      ...newNote,
      voice: Voice.world(),
      anchor: Anchor.of({
        body: 'pin this.',
        path: 'compose.yml',
        from: 22,
        reviewComment: 'PRRC_kwDO',
      }),
    };

    const opened = () =>
      added()
        .assignRun(RUN, LINE)
        .recordPullRequest(
          RUN,
          PullRequestUrl.of('https://github.com/acme/widgets/pull/7'),
          NOW,
          LINE,
        );

    it('offers what nobody has answered, and nothing else', () => {
      const received = added().addMessage(reviewComment);

      expect(received.openReviewComments.map((each) => each.at.value)).toEqual([
        0,
      ]);
      expect(added().askedAbout(newNote, null).openReviewComments).toEqual([]);
    });

    it('records the reply, and marks the review comment answered', () => {
      const replied = opened()
        .addMessage(reviewComment)
        .recordReviewCommentReply(RUN, HERE, NotePosition.of(0), newNote);

      expect(replied.notes[0]?.answeredAt).toEqual(NOW);
      expect(replied.openReviewComments).toEqual([]);
      expect(replied.notes[1]?.kind).toBe('message');
      expect(replied.notes[1]?.voice.isStation).toBe(true);
    });

    it('replies on the pull request the review comment was made on', () => {
      const docs = PullRequestUrl.of('https://github.com/acme/docs/pull/3');
      const toReply = opened()
        .recordPullRequest(RUN, docs, NOW, LINE)
        .addMessage({
          ...reviewComment,
          anchor: Anchor.of({
            body: 'say why.',
            path: 'guide.md',
            reviewComment: 'PRRC_docs',
            pullRequest: docs.value,
          }),
        })
        .reviewCommentToReplyFrom(RUN, HERE, NotePosition.of(0));

      expect(toReply.pullRequest).toEqual(docs);
      expect(toReply.repository).toEqual(Repository.of('acme/docs'));
    });

    it('replies on the first pull request to a review comment that names none', () => {
      const toReply = opened()
        .addMessage(reviewComment)
        .reviewCommentToReplyFrom(RUN, HERE, NotePosition.of(0));

      expect(toReply.pullRequest.value).toBe(
        'https://github.com/acme/widgets/pull/7',
      );
    });

    it('leaves the reply out of what is unacknowledged', () => {
      const replied = opened()
        .addMessage(reviewComment)
        .acknowledgeUpTo(RUN, NotePosition.of(0), NOW)
        .recordReviewCommentReply(RUN, HERE, NotePosition.of(0), newNote);

      expect(replied.unacknowledged).toEqual([]);
    });

    it('will not reply to a review comment twice, or to one that was never made', () => {
      const replied = opened()
        .addMessage(reviewComment)
        .recordReviewCommentReply(RUN, HERE, NotePosition.of(0), newNote);

      expect(() =>
        replied.recordReviewCommentReply(
          RUN,
          HERE,
          NotePosition.of(0),
          newNote,
        ),
      ).toThrow(InvalidTaskTransitionError);
      expect(() =>
        opened().recordReviewCommentReply(
          RUN,
          HERE,
          NotePosition.of(0),
          newNote,
        ),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not answer from a station the task has left', () => {
      const received = opened().addMessage(reviewComment);

      expect(() =>
        received.reviewCommentToReplyFrom(
          RUN,
          StationId.of('station_2'),
          NotePosition.of(0),
        ),
      ).toThrow(InvalidTaskTransitionError);
      expect(() =>
        received.reviewCommentToReplyFrom(RUN, null, NotePosition.of(0)),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not answer where there is no pull request to answer on', () => {
      expect(() =>
        added()
          .assignRun(RUN, LINE)
          .addMessage(reviewComment)
          .reviewCommentToReplyFrom(RUN, HERE, NotePosition.of(0)),
      ).toThrow(NoRepositoryError);
    });

    it('answers only for its current run', () => {
      const received = opened().addMessage(reviewComment);

      expect(() =>
        received.reviewCommentToReplyFrom(
          RunId.of('run_2'),
          HERE,
          NotePosition.of(0),
        ),
      ).toThrow(InvalidTaskTransitionError);
      expect(() =>
        received.recordReviewCommentReply(
          RunId.of('run_2'),
          HERE,
          NotePosition.of(0),
          newNote,
        ),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('names the pull request, its repository and the review comment it replies to', () => {
      const answering = opened()
        .addMessage(reviewComment)
        .reviewCommentToReplyFrom(RUN, HERE, NotePosition.of(0));

      expect(answering.repository.value).toBe('acme/widgets');
      expect(answering.reviewComment.value).toBe('PRRC_kwDO');
    });
  });

  describe('what it rejects', () => {
    it('will not be put to a person twice over', () => {
      expect(() =>
        added().askedAbout(newNote, null).askedAbout(newNote, null),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not close a conversation that nothing opened', () => {
      expect(() => added().closeConversation(newNote)).toThrow(
        InvalidTaskTransitionError,
      );
    });

    it('will not close the same conversation twice', () => {
      expect(() =>
        added()
          .askedAbout(newNote, null)
          .closeConversation(newNote)
          .closeConversation(newNote),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not be taken up while a person is asked, once finished, or where nothing runs', () => {
      expect(() =>
        added().askedAbout(newNote, null).assignRun(RUN, LINE),
      ).toThrow(InvalidTaskTransitionError);
      expect(() =>
        added()
          .react(LINE, StationId.of('completed_1'), TaskRank.of('m'), newNote)
          .assignRun(RUN, LINE),
      ).toThrow(InvalidTaskTransitionError);
      expect(() =>
        added()
          .react(LINE, StationId.of('station_0'), TaskRank.of('m'), newNote)
          .assignRun(RUN, LINE),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not be taken up by a second run while it has a current run', () => {
      expect(() =>
        added()
          .assignRun(RunId.of('run_1'), LINE)
          .assignRun(RunId.of('run_2'), LINE),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not be passed to the station it is already at', () => {
      expect(() =>
        added().react(
          LINE,
          StationId.of('station_1'),
          TaskRank.of('m'),
          newNote,
        ),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not answer a conversation that has already closed', () => {
      const carried = added()
        .askedAbout(newNote, null)
        .react(LINE, StationId.of('station_2'), TaskRank.of('m'), newNote)
        .askedAbout(newNote, null);

      expect(() => carried.answer(NotePosition.of(0), newNote)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(carried.answer(NotePosition.of(2), newNote).notes).toHaveLength(4);
    });

    it('will not be moved to the station it is already at', () => {
      expect(() =>
        added().react(
          LINE,
          StationId.of('station_1'),
          TaskRank.of('m'),
          newNote,
        ),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('is finished once a run has nothing further to do with it', () => {
      const ended = added().assignRun(RUN, LINE).finishHere(RUN, LINE, newNote);

      expect(ended.finished).toBe(true);
      expect(ended.currentRunId).toBeNull();
      expect(
        ended.addMessage({ ...newNote, line: LINE, voice: Voice.world() })
          .finished,
      ).toBe(false);
    });

    it('finishes the task when it is moved to the end of the line', () => {
      const landed = added().react(
        LINE,
        StationId.of('completed_1'),
        TaskRank.of('m'),
        newNote,
      );

      expect(landed.finished).toBe(true);
      expect(landed.currentRunId).toBeNull();
    });

    it('is unfinished again once a person answers what was put to them', () => {
      const asked = added()
        .assignRun(RUN, LINE)
        .finishHere(RUN, LINE, newNote)
        .askedAbout(newNote, null);

      expect(
        asked.answer(NotePosition.of(1), {
          ...newNote,
          line: LINE,
          voice: Voice.person(UserId.of('user_1')),
        }).finished,
      ).toBe(false);
    });
  });

  describe('detaching a run', () => {
    const detached = (task: Task) =>
      task
        .pullEvents()
        .filter((each) => each.kind === 'task.run-detached')
        .map((each) => (each as TaskRunDetached).runId);

    const assigned = () => {
      const task = added().assignRun(RUN, LINE);
      task.pullEvents();
      return task;
    };

    it('detaches its current run when moved by hand', () => {
      expect(
        detached(
          assigned().moveTo(
            LINE,
            StationId.of('station_0'),
            TaskRank.of('m'),
            newNote,
            { mover: UserId.of('user_1') },
          ),
        ),
      ).toEqual([RUN]);
    });

    it('detaches its current run when deleted', () => {
      const gone = assigned().deleted();

      expect(gone.currentRunId).toBeNull();
      expect(detached(gone)).toEqual([RUN]);
    });

    it('detaches nothing when it has no current run', () => {
      expect(
        detached(
          added().react(
            LINE,
            StationId.of('station_2'),
            TaskRank.of('m'),
            newNote,
          ),
        ),
      ).toEqual([]);
      expect(detached(added().deleted())).toEqual([]);
    });

    it('detaches nothing when its current run passes it on', () => {
      expect(
        detached(
          assigned().passedOn(
            RUN,
            LINE,
            StationId.of('station_2'),
            TaskRank.of('m'),
            newNote,
          ),
        ),
      ).toEqual([]);
    });
  });

  describe('opening a pull request', () => {
    const url = PullRequestUrl.of('https://github.com/acme/widgets/pull/7');

    it('is opened only for its current run', () => {
      expect(() => added().recordPullRequest(RUN, url, NOW, LINE)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(() =>
        added()
          .assignRun(RUN, LINE)
          .recordPullRequest(RunId.of('run_2'), url, NOW, LINE),
      ).toThrow(InvalidTaskTransitionError);
      expect(
        added().assignRun(RUN, LINE).recordPullRequest(RUN, url, NOW, LINE)
          .pullRequest,
      ).toEqual(url);
    });

    describe('in several repositories', () => {
      const docs = PullRequestUrl.of('https://github.com/acme/docs/pull/3');
      const opened = () =>
        added()
          .assignRun(RUN, LINE)
          .recordPullRequest(RUN, url, NOW, LINE)
          .recordPullRequest(RUN, docs, NOW, LINE);

      it('holds one for each repository, the first opened first', () => {
        const task = opened();

        expect(task.pullRequest).toEqual(url);
        expect(task.pullRequests).toEqual([url, docs]);
      });

      it('finds each by its repository', () => {
        const task = opened();

        expect(task.pullRequestIn(Repository.of('acme/docs'))).toEqual(docs);
        expect(task.pullRequestIn(Repository.of('acme/widgets'))).toEqual(url);
        expect(task.pullRequestIn(Repository.of('acme/api'))).toBeNull();
        expect(task.pullRequestIn(null)).toEqual(url);
      });

      it('edits the one in a repository and opens one in a repository without one', () => {
        const task = added()
          .assignRun(RUN, LINE)
          .recordPullRequest(RUN, url, NOW, LINE);

        expect(task.pullRequestStep(Repository.of('acme/widgets'))).toEqual({
          kind: 'edit',
          pullRequest: url,
        });
        expect(task.pullRequestStep(Repository.of('acme/docs'))).toEqual({
          kind: 'open',
        });
      });

      it('keeps the first where a second is opened in the same repository', () => {
        const task = opened().recordPullRequest(
          RUN,
          PullRequestUrl.of('https://github.com/acme/docs/pull/4'),
          NOW,
          LINE,
        );

        expect(task.pullRequests).toEqual([url, docs]);
      });

      it('is never stored with two in one repository, or later ones without a first', () => {
        const task = added();

        expect(() =>
          Task.rehydrate({
            ...task,
            pullRequestLink: PullRequestLink.opened(url),
            laterPullRequests: [
              LaterPullRequest.of(
                PullRequestUrl.of('https://github.com/Acme/Widgets/pull/9'),
                NOW,
              ),
            ],
          }),
        ).toThrow(InconsistentStateError);
        expect(() =>
          Task.rehydrate({
            ...task,
            laterPullRequests: [LaterPullRequest.of(docs, NOW)],
          }),
        ).toThrow(InconsistentStateError);
      });

      it('keeps a later one when its mark moves to another task', () => {
        const task = opened().releaseMark(Mark.pullRequest(docs));

        expect(task.pullRequestIn(Repository.of('acme/docs'))).toEqual(docs);
      });

      it('takes no pull request of a mark it did not open as its own', () => {
        const task = added()
          .assignRun(RUN, LINE)
          .markedBy(Mark.pullRequest(docs), NOW);

        expect(task.pullRequests).toEqual([]);
        expect(task.pullRequestStep(Repository.of('acme/docs'))).toEqual({
          kind: 'open',
        });
      });

      it('finds one whatever the letter case of the repository name', () => {
        expect(opened().pullRequestIn(Repository.of('Acme/Docs'))).toEqual(
          docs,
        );
      });

      it('knows which of its pull requests are still open', () => {
        const task = opened();

        expect(task.openPullRequests).toEqual([url, docs]);
        expect(task.pullRequestClosed(url, NOW).openPullRequests).toEqual([
          docs,
        ]);
        expect(
          task.pullRequestClosed(url, NOW).pullRequestClosed(docs, NOW)
            .openPullRequests,
        ).toEqual([]);
      });

      it('ignores a close of a pull request it does not own', () => {
        const task = opened();

        expect(
          task.pullRequestClosed(
            PullRequestUrl.of('https://github.com/acme/other/pull/1'),
            NOW,
          ),
        ).toBe(task);
      });

      it('counts a pull request open again once it reopens', () => {
        const task = opened()
          .pullRequestClosed(url, NOW)
          .pullRequestClosed(docs, NOW);

        expect(task.pullRequestReopened(docs).openPullRequests).toEqual([docs]);
        expect(task.pullRequestReopened(url).openPullRequests).toEqual([url]);
      });

      it('closes a pull request named in another letter case', () => {
        expect(
          opened().pullRequestClosed(
            PullRequestUrl.of('https://github.com/Acme/Docs/pull/3'),
            NOW,
          ).openPullRequests,
        ).toEqual([url]);
      });

      it('records each one it opens', () => {
        const task = added().assignRun(RUN, LINE);
        task.pullEvents();

        const kinds = task
          .recordPullRequest(RUN, url, NOW, LINE)
          .recordPullRequest(RUN, docs, NOW, LINE)
          .pullEvents()
          .map((each) => each.kind)
          .filter((kind) => kind === 'task.pull-request-opened');

        expect(kinds).toHaveLength(2);
      });
    });
  });

  describe('reviewing a pull request', () => {
    const url = PullRequestUrl.of('https://github.com/acme/widgets/pull/7');

    it('has the mark of the pull request, and reviews it rather than owning it', () => {
      const reviewing = added().reviews(
        url,
        { outside: false },
        LINE,
        new Date(0),
      );

      expect(reviewing.pullRequest).toEqual(url);
      expect(reviewing.reviewing).toBe(true);
      expect(reviewing.reviewedHead).toEqual({
        repository: Repository.of('acme/widgets'),
        ref: 'refs/pull/7/head',
      });
      expect(reviewing.marks.map(String)).toEqual([
        `github.review:${url.value}`,
      ]);
    });

    it('says which pull request it reviews, so Insights can tell people’s pull requests Spotlight touched', () => {
      const reviewing = added().reviews(
        url,
        { outside: false },
        LINE,
        new Date(0),
      );

      expect(reviewing.pullEvents()).toContainEqual(
        expect.objectContaining({
          kind: 'task.pull-request-review-taken',
          taskId: reviewing.id,
          url,
        }),
      );
    });

    it('reviews only a pull request whose head it can check out', () => {
      expect(() =>
        added().reviews(
          PullRequestUrl.of('https://gitlab.example/acme/7'),
          {
            outside: false,
          },
          LINE,
          new Date(0),
        ),
      ).toThrow(UnreviewablePullRequestError);
    });

    it('reviews nothing once it has a pull request of its own', () => {
      const own = added()
        .assignRun(RUN, LINE)
        .recordPullRequest(RUN, url, NOW, LINE);

      expect(own.reviewing).toBe(false);
      expect(own.reviewedHead).toBeNull();
      expect(() =>
        own.reviews(url, { outside: false }, LINE, new Date(0)),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('neither opens nor edits a pull request while it reviews one', () => {
      const reviewing = added().reviews(url, { outside: false }, LINE, NOW);

      expect(() => reviewing.pullRequestStep(null)).toThrow(
        InvalidTaskTransitionError,
      );
    });

    it('opens no pull request of its own while it reviews one', () => {
      const reviewing = added()
        .reviews(url, { outside: false }, LINE, new Date(0))
        .assignRun(RUN, LINE);

      expect(() =>
        reviewing.recordPullRequest(
          RUN,
          PullRequestUrl.of('https://github.com/acme/docs/pull/3'),
          NOW,
          LINE,
        ),
      ).toThrow(InvalidTaskTransitionError);
    });
  });

  describe('routed by a run', () => {
    const assigned = () => added().assignRun(RUN, LINE);
    const other = RunId.of('run_2');

    it('is passed on only by its current run', () => {
      expect(() =>
        assigned().passedOn(
          other,
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          newNote,
        ),
      ).toThrow(InvalidTaskTransitionError);
      expect(
        assigned().passedOn(
          RUN,
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          newNote,
        ).stationId,
      ).toEqual(StationId.of('station_2'));
    });

    it('is passed on only where the line leads from where it is', () => {
      expect(() =>
        assigned().passedOn(
          RUN,
          LINE,
          StationId.of('station_0'),
          TaskRank.of('m'),
          newNote,
        ),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('is finished only by its current run', () => {
      expect(() => assigned().finishHere(other, LINE, newNote)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(() => added().finishHere(RUN, LINE, newNote)).toThrow(
        InvalidTaskTransitionError,
      );
    });

    it('is finished only where its line ends', () => {
      const passed = assigned()
        .passedOn(
          RUN,
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          newNote,
        )
        .assignRun(RUN, LINE);

      expect(() => passed.finishHere(RUN, LINE, newNote)).toThrow(
        InvalidTaskTransitionError,
      );
    });

    it('is put to a person by its current run, or by nobody while no run does', () => {
      expect(() => assigned().askedAbout(newNote, other)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(() => assigned().askedAbout(newNote, null)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(() => added().askedAbout(newNote, RUN)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(assigned().askedAbout(newNote, RUN).running).toBe(false);
    });
  });

  describe('moving along its line', () => {
    const ELSEWHERE = lineMapOf({
      id: LineId.of('line_2'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      key: LineKey.of('ops'),
      name: LineName.of('Ops'),
      stations: [
        station('station_9', 'Backlog', 0, { kind: 'backlog' }),
        station('completed_9', 'Completed', 1, { kind: 'completed' }),
      ],
    });

    it('will not be moved by a line it is not on', () => {
      expect(() =>
        added().react(
          ELSEWHERE,
          ELSEWHERE.backlog.id,
          TaskRank.of('m'),
          newNote,
        ),
      ).toThrow(UnknownStationError);
    });

    it('will not be moved to a station off its line', () => {
      expect(() =>
        added().react(LINE, ELSEWHERE.backlog.id, TaskRank.of('m'), newNote),
      ).toThrow(UnknownStationError);
    });

    it('will not be passed on to a station off its line', () => {
      expect(() =>
        added()
          .assignRun(RUN, LINE)
          .passedOn(RUN, LINE, ELSEWHERE.backlog.id, TaskRank.of('m'), newNote),
      ).toThrow(UnknownStationError);
    });

    const inBacklog = () =>
      Task.add({
        line: LINE,
        at: StationId.of('station_0'),
        title: TaskTitle.of('Fix the queue'),
        rank: TaskRank.of('i'),
        now: NOW,
        newId: () => 'task_1',
      });

    const mover = { mover: UserId.of('user_2') };

    it('is taken up by whoever moves it by hand out of the backlog into work', () => {
      expect(
        inBacklog().moveTo(
          LINE,
          StationId.of('station_1'),
          TaskRank.of('m'),
          newNote,
          mover,
        ).assignee,
      ).toEqual(UserId.of('user_2'));
    });

    it('is not taken up when parked back in the backlog by hand', () => {
      expect(
        added()
          .unassign()
          .moveTo(
            LINE,
            StationId.of('station_0'),
            TaskRank.of('m'),
            newNote,
            mover,
          ).assignee,
      ).toBeNull();
    });

    it('is not taken up when it leaves the backlog without a hand to move it', () => {
      expect(
        inBacklog().react(
          LINE,
          StationId.of('station_1'),
          TaskRank.of('m'),
          newNote,
        ).assignee,
      ).toBeNull();
    });
  });

  describe('moved by a person', () => {
    const hand = { mover: UserId.of('user_2') };
    const BACKLOG = StationId.of('station_0');
    const COMPLETED = StationId.of('completed_1');

    const at = (stationId: StationId) =>
      Task.add({
        line: LINE,
        at: stationId,
        title: TaskTitle.of('Fix the queue'),
        rank: TaskRank.of('i'),
        now: NOW,
        newId: () => 'task_1',
      });

    const moved = (from: StationId, to: StationId) =>
      at(from).moveTo(LINE, to, TaskRank.of('m'), newNote, hand);

    it('starts from the backlog at any work station', () => {
      expect(moved(BACKLOG, HERE).stationId).toEqual(HERE);
      expect(moved(BACKLOG, StationId.of('station_2')).stationId).toEqual(
        StationId.of('station_2'),
      );
    });

    it('closes from anywhere into completed', () => {
      expect(moved(BACKLOG, COMPLETED).finished).toBe(true);
      expect(moved(HERE, COMPLETED).finished).toBe(true);
    });

    it('parks from a work station back in the backlog, detaching its run', () => {
      const parked = at(HERE)
        .assignRun(RUN, LINE)
        .moveTo(LINE, BACKLOG, TaskRank.of('m'), newNote, hand);

      expect(parked.stationId).toEqual(BACKLOG);
      expect(parked.running).toBe(false);
      expect(parked.pullEvents().map((each) => each.kind)).toContain(
        'task.run-detached',
      );
    });

    it('tells whether a person started, parked or closed it', () => {
      expect(actsOf(moved(BACKLOG, HERE))).toEqual([
        { action: 'started', by: 'user_2', after: null },
      ]);
      expect(actsOf(moved(HERE, BACKLOG))).toEqual([
        { action: 'parked', by: 'user_2', after: null },
      ]);
      expect(actsOf(moved(HERE, COMPLETED))).toEqual([
        { action: 'accepted', by: 'user_2', after: null },
      ]);
    });

    it('names the run that last wrote a note on it when a person closes it', () => {
      const finished = at(HERE)
        .assignRun(RUN, LINE)
        .finishHere(RUN, LINE, { ...newNote, voice: Voice.station(RUN) });
      const reopened = finished.receiveMessage(
        RUN,
        { ...newNote, voice: Voice.person(UserId.of('user_1')) },
        HERE,
      );
      reopened.pullEvents();

      expect(
        actsOf(
          reopened.moveTo(LINE, COMPLETED, TaskRank.of('m'), newNote, hand),
        ),
      ).toEqual([{ action: 'accepted', by: 'user_2', after: 'run_1' }]);
    });

    it('tells nothing a person did when a reaction moves it', () => {
      expect(
        actsOf(
          at(HERE).react(
            LINE,
            StationId.of('station_2'),
            TaskRank.of('m'),
            newNote,
          ),
        ),
      ).toEqual([]);
    });

    it('will not be moved between work stations, which its runs pass it along', () => {
      expect(() => moved(HERE, StationId.of('station_2'))).toThrow(
        new MoveDeniedError('between-work-stations', 'Triage', 'Spec'),
      );
    });

    it('will not be moved out of completed', () => {
      const closed = moved(HERE, COMPLETED);

      expect(() =>
        closed.moveTo(LINE, BACKLOG, TaskRank.of('m'), newNote, hand),
      ).toThrow(MoveDeniedError);
      expect(() =>
        closed.moveTo(LINE, HERE, TaskRank.of('m'), newNote, hand),
      ).toThrow(MoveDeniedError);
    });

    it('is moved between work stations by a reaction, without a hand', () => {
      expect(
        at(HERE).react(
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          newNote,
        ).stationId,
      ).toEqual(StationId.of('station_2'));
    });
  });

  describe('wanting a run', () => {
    it('wants one while idle at a station something runs at', () => {
      expect(added().wantsRun(LINE)).toBe(true);
    });

    it('wants none while it has a current run, a person is asked, or it is finished', () => {
      expect(added().assignRun(RUN, LINE).wantsRun(LINE)).toBe(false);
      expect(added().askedAbout(newNote, null).wantsRun(LINE)).toBe(false);
      expect(
        added()
          .react(LINE, StationId.of('completed_1'), TaskRank.of('m'), newNote)
          .wantsRun(LINE),
      ).toBe(false);
    });

    it('wants none where nothing runs', () => {
      expect(
        added()
          .react(LINE, StationId.of('station_0'), TaskRank.of('m'), newNote)
          .wantsRun(LINE),
      ).toBe(false);
    });
  });

  describe('its trail', () => {
    it('rejects a gap in it', () => {
      expect(() =>
        Task.rehydrate({
          ...added(),
          notes: [
            TaskNote.of({
              ...newNote,
              station: null,
              stationId: HERE,
              kind: 'message',
              position: NotePosition.of(1),
            }),
          ],
        }),
      ).toThrow(InconsistentStateError);
    });

    it('refuses a negative version', () => {
      expect(() => Task.rehydrate({ ...added(), version: -1 })).toThrow(
        InconsistentStateError,
      );
    });
  });

  describe('telling where it moved', () => {
    const movedEvents = (task: Task) =>
      task.pullEvents().filter((each) => each instanceof TaskMoved);

    it('says it moved from one station’s key to another’s, and when', () => {
      const task = added();
      task.pullEvents();

      const [moved] = movedEvents(
        task.react(LINE, StationId.of('station_2'), TaskRank.of('m'), newNote),
      );

      expect(moved).toEqual(
        new TaskMoved(
          task.id,
          task.workspaceId,
          { id: StationId.of('station_1'), key: StationKey.of('station-1') },
          { id: StationId.of('station_2'), key: StationKey.of('station-2') },
          NOW,
        ),
      );
    });

    it('says it moved when a run passes it on', () => {
      const assigned = added().assignRun(RUN, LINE);
      assigned.pullEvents();

      const [moved] = movedEvents(
        assigned.passedOn(
          RUN,
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          newNote,
        ),
      );

      expect(moved?.to.key).toEqual(StationKey.of('station-2'));
    });

    it('says nothing moved when it is only reordered', () => {
      const task = added();
      task.pullEvents();

      expect(movedEvents(task.reorderTo(TaskRank.of('z')))).toEqual([]);
    });

    it('says which run passed it on, from where to where and when', () => {
      const assigned = added().assignRun(RUN, LINE);
      assigned.pullEvents();

      const passed = assigned
        .passedOn(
          RUN,
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          newNote,
        )
        .pullEvents()
        .filter((each) => each instanceof TaskPassed);

      expect(passed).toEqual([
        new TaskPassed(
          assigned.id,
          assigned.workspaceId,
          RUN,
          HERE,
          StationId.of('station_2'),
          NOW,
        ),
      ]);
    });

    it('says nothing was passed on when a happening moves it', () => {
      const task = added();
      task.pullEvents();

      expect(
        task
          .react(LINE, StationId.of('station_2'), TaskRank.of('m'), newNote)
          .pullEvents()
          .filter((each) => each instanceof TaskPassed),
      ).toEqual([]);
    });
  });
});

describe('Task, a failure reported on it', () => {
  const RUN_EXITED = TaskFailure.fromRun('exited');
  const LOOPED = TaskFailure.fromHook('notify', 'loop');
  const withRun = () => added().assignRun(RUN, LINE);
  const failure = (body: string) => ({
    ...newNote,
    body: TaskNoteBody.of(body),
  });

  it('puts the first failure to a person, saying where it came from', () => {
    const failed = withRun().failed(
      RUN_EXITED,
      failure('It exited 1.'),
      RUN,
      LINE,
    );

    expect(failed.awaitingReview).toBe(true);
    expect(failed.running).toBe(false);
    expect(failed.notes[0]?.kind).toBe('asked');
    expect(failed.notes[0]?.form).toBe('failure');
    expect(failed.notes[0]?.failure?.equals(RUN_EXITED)).toBe(true);
  });

  it('counts the same failure again while a person has not yet answered, rather than asking twice', () => {
    const failed = added()
      .failed(LOOPED, failure('Stopped a loop.'), null, LINE)
      .failed(LOOPED, failure('Stopped it again.'), null, LINE);

    expect(failed.notes).toHaveLength(1);
    expect(failed.notes[0]?.failure?.occurrences).toBe(2);
    expect(failed.notes[0]?.unread).toBe(true);
  });

  it('keeps a repeat in the conversation it belongs to once a person has answered', () => {
    const asked = withRun().failed(
      RUN_EXITED,
      failure('It exited 1.'),
      RUN,
      LINE,
    );
    const answered = asked.answer(NotePosition.of(0), {
      ...newNote,
      body: TaskNoteBody.of('Try again.'),
      voice: Voice.person(UserId.of('user_1')),
    });
    const again = answered
      .assignRun(RunId.of('run_2'), LINE)
      .failed(
        RUN_EXITED,
        failure('It exited 1 again.'),
        RunId.of('run_2'),
        LINE,
      );

    expect(again.openConversation?.from).toEqual(NotePosition.of(0));
    expect(again.notes.map((each) => each.kind)).toEqual([
      'asked',
      'answered',
      'asked',
    ]);
    expect(again.notes[2]?.failure?.occurrences).toBe(2);
  });

  it('says a different failure in the open conversation rather than opening another', () => {
    const failed = added()
      .failed(LOOPED, failure('Stopped a loop.'), null, LINE)
      .failed(
        TaskFailure.fromHook('audit', 'loop'),
        failure('Stopped another.'),
        null,
        LINE,
      );

    expect(failed.notes.map((each) => each.kind)).toEqual(['asked', 'message']);
    expect(failed.openConversation?.from).toEqual(NotePosition.of(0));
  });

  it('detaches the run working it when the failure is not that run’s', () => {
    const failed = withRun().failed(
      LOOPED,
      failure('Stopped a loop.'),
      null,
      LINE,
    );

    expect(failed.running).toBe(false);
    expect(failed.pullEvents().map((each) => each.kind)).toContain(
      'task.run-detached',
    );
  });

  it('puts no failure on a finished task to anyone', () => {
    const finished = withRun().finishHere(RUN, LINE, newNote);

    expect(finished.movedOnFrom(HERE)).toBe(true);
    expect(() =>
      finished.failed(LOOPED, failure('Stopped a loop.'), null, LINE),
    ).toThrow(InvalidTaskTransitionError);
  });

  it('says each failure raised, where it was raised and how often it has repeated', () => {
    const failed = added()
      .failed(LOOPED, failure('Stopped a loop.'), null, LINE)
      .failed(LOOPED, failure('Stopped it again.'), null, LINE)
      .failed(RUN_EXITED, failure('It exited 1.'), null, LINE);

    expect(
      failed
        .pullEvents()
        .filter((each) => each instanceof TaskFailed)
        .map((each) => [
          each.stationId.value,
          each.failure.source,
          each.failure.code,
          each.failure.occurrences,
        ]),
    ).toEqual([
      [HERE.value, 'hook:notify', 'loop', 1],
      [HERE.value, 'hook:notify', 'loop', 2],
      [HERE.value, 'run', 'exited', 1],
    ]);
  });

  it('says which team’s line the failed task is on', () => {
    const [raised] = withRun()
      .failed(RUN_EXITED, failure('It exited 1.'), RUN, LINE)
      .pullEvents()
      .filter((each) => each instanceof TaskFailed);

    expect(raised?.teamId).toEqual(LINE.teamId);
  });

  it('leaves the task it failed from untouched, recording the failure only on the task it returns', () => {
    const task = withRun();
    task.pullEvents();

    const failed = task.failed(RUN_EXITED, failure('It exited 1.'), RUN, LINE);

    expect(task.hasEvents).toBe(false);
    expect(
      failed.pullEvents().filter((each) => each instanceof TaskFailed),
    ).toHaveLength(1);
  });

  it('says which run raised a failure, and when', () => {
    const [raised] = withRun()
      .failed(RUN_EXITED, failure('It exited 1.'), RUN, LINE)
      .pullEvents()
      .filter((each) => each instanceof TaskFailed);

    expect(raised?.by).toEqual(RUN);
    expect(raised?.at).toEqual(NOW);
  });

  it('says when it put the failure to a person', () => {
    const [asked] = withRun()
      .failed(RUN_EXITED, failure('It exited 1.'), RUN, LINE)
      .pullEvents()
      .filter((each) => each instanceof TaskAsked);

    expect(asked?.at).toEqual(NOW);
  });

  it('knows it has moved on from a station it is no longer at', () => {
    expect(added().movedOnFrom(HERE)).toBe(false);
    expect(added().movedOnFrom(StationId.of('station_2'))).toBe(true);
    expect(added().movedOnFrom(null)).toBe(false);
  });
});

describe('Task, its revision', () => {
  it('starts at the first revision and counts each move', () => {
    const moved = added().react(
      LINE,
      StationId.of('station_2'),
      TaskRank.of('i'),
      newNote,
    );

    expect(added().revision.value).toBe(0);
    expect(moved.revision.value).toBe(1);
    expect(moved.isAtRevision(TaskRevision.of(1))).toBe(true);
  });

  it('counts being finished as a move', () => {
    expect(
      added().assignRun(RUN, LINE).finishHere(RUN, LINE, newNote).revision
        .value,
    ).toBe(1);
  });

  it('does not count a message on it as a move', () => {
    expect(added().addMessage(newNote).revision.value).toBe(0);
  });

  it('rejects what was decided on a revision it has moved on from', () => {
    expect(added().assertRevision(TaskRevision.of(0)).revision.value).toBe(0);
    expect(() => added().assertRevision(TaskRevision.of(1))).toThrow(
      StaleTaskRevisionError,
    );
    expect(() => TaskRevision.of(-1)).toThrow(InvalidTaskRevisionError);
  });
});

describe('Task and the happenings received while it has a current run', () => {
  const world = { ...newNote, voice: Voice.world() };
  const SPEC = StationId.of('station_2');
  const COMPLETED = StationId.of('completed_1');

  const assigned = () => {
    const task = added().assignRun(RUN, LINE);
    task.pullEvents();
    return task;
  };

  const detached = (task: Task) =>
    task
      .pullEvents()
      .filter((each) => each.kind === 'task.run-detached')
      .map((each) => (each as TaskRunDetached).runId);

  it('cannot be moved by a happening while it has a current run', () => {
    expect(() => assigned().react(LINE, SPEC, TaskRank.of('m'), world)).toThrow(
      InvalidTaskTransitionError,
    );
  });

  it('is moved by a happening while it has no current run, detaching nothing', () => {
    const moved = added().react(LINE, SPEC, TaskRank.of('m'), world);

    expect(moved.stationId).toEqual(SPEC);
    expect(detached(moved)).toEqual([]);
  });

  it('defers a move only while it has a current run, and never to where it is', () => {
    expect(() => added().deferMove(LINE, SPEC, world)).toThrow(
      InvalidTaskTransitionError,
    );
    expect(() => assigned().deferMove(LINE, HERE, world)).toThrow(
      InvalidTaskTransitionError,
    );
  });

  it('keeps the run and the station while a move is deferred', () => {
    const noted = assigned().deferMove(LINE, SPEC, world);

    expect(noted.stationId).toEqual(HERE);
    expect(noted.currentRunId).toEqual(RUN);
    expect(noted.deferredMoveTo).toEqual(SPEC);
    expect(noted.pullEvents().map((event) => event.kind)).toEqual([
      'task.noted',
    ]);
  });

  it('defers only the latest move', () => {
    expect(
      assigned()
        .deferMove(LINE, StationId.of('station_0'), world)
        .deferMove(LINE, SPEC, world).deferredMoveTo,
    ).toEqual(SPEC);
  });

  it('defers nothing once the run has passed it on, put it to a person, or a person moved it', () => {
    const noted = assigned().deferMove(LINE, SPEC, world);

    expect(
      noted.moveTo(LINE, StationId.of('station_0'), TaskRank.of('m'), newNote, {
        mover: UserId.of('user_1'),
      }).deferredMoveTo,
    ).toBeNull();

    expect(noted.askedAbout(newNote, RUN).deferredMoveTo).toBeNull();
    expect(
      noted.passedOn(RUN, LINE, SPEC, TaskRank.of('m'), newNote).deferredMoveTo,
    ).toBeNull();
    expect(noted.addMessage(world).deferredMoveTo).toEqual(SPEC);
  });

  it('keeps a deferred move across a tool approval asked and granted while the run works', () => {
    const asked = assigned()
      .deferMove(LINE, SPEC, world)
      .clearFor(
        ApprovalSubject.toolCall(
          ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
        ),
        ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
        { ...newNote, voice: Voice.station(RUN) },
        RUN,
        null,
      ).task;

    expect(asked.deferredMoveTo).toEqual(SPEC);

    const granted = asked.answer(
      NotePosition.of(1),
      { ...newNote, voice: Voice.person(UserId.of('user_1')) },
      'approved',
    );

    expect(granted.deferredMoveTo).toEqual(SPEC);
    expect(
      granted.moveAsDeferred(
        RUN,
        LINE,
        SPEC,
        TaskRank.of('m'),
        ending(ResolvedHandover.done(TaskNoteBody.of('Done.'))),
      ).stationId,
    ).toEqual(SPEC);
  });

  it('stops the run waiting on a tool approval when the approval is resolved', () => {
    const asking = assigned().clearFor(
      ApprovalSubject.toolCall(
        ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
      ),
      ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
      { ...newNote, voice: Voice.station(RUN) },
      RUN,
      null,
    ).task;

    asking.pullEvents();

    const resolved = asking.resolveAt(NotePosition.of(0), newNote);

    expect(resolved.currentRunId).toBeNull();
    expect(detached(resolved)).toEqual([RUN]);
    expect(resolved.openConversation).toBeNull();
    expect(resolved.notes[resolved.notes.length - 1]).toMatchObject({
      kind: 'passed',
      form: 'resolved',
    });
  });

  it('is finished by a happening while its run works, detaching the run', () => {
    const finished = assigned().react(LINE, COMPLETED, TaskRank.of('m'), world);

    expect(finished.stationId).toEqual(COMPLETED);
    expect(finished.finished).toBe(true);
    expect(finished.currentRunId).toBeNull();
    expect(finished.awaitingReview).toBe(false);
    expect(detached(finished)).toEqual([RUN]);
  });

  it('cannot be moved by a happening to a station other than the completed one while its run works', () => {
    expect(() => assigned().react(LINE, SPEC, TaskRank.of('m'), world)).toThrow(
      InvalidTaskTransitionError,
    );
  });

  it('does not defer a move to the end of its line', () => {
    expect(() => assigned().deferMove(LINE, COMPLETED, world)).toThrow(
      InvalidTaskTransitionError,
    );
  });

  const ending = (handover: ResolvedHandover) => ({
    newNote: { ...newNote, voice: Voice.station(RUN) },
    handover,
  });

  it('is moved where a move was deferred to by the run that deferred it, saying why and in the run’s own words', () => {
    const moved = assigned()
      .deferMove(LINE, SPEC, world)
      .moveAsDeferred(
        RUN,
        LINE,
        SPEC,
        TaskRank.of('m'),
        ending(
          ResolvedHandover.review(
            TaskNoteBody.of('The run asked for someone to look at this.'),
            TaskNoteBody.of('Uploads retry now.'),
          ),
        ),
      );

    const [, passed] = moved.notes;

    expect(moved.stationId).toEqual(SPEC);
    expect(moved.currentRunId).toBeNull();
    expect(passed?.kind).toBe('passed');
    expect(passed?.form).toBe('words');
    expect(passed?.body.value).toBe(
      'Moved to Spec when the run ended. An event arrived while the run was in progress.\n\nUploads retry now.',
    );
  });

  it('keeps the failure of a run that failed when a deferred move takes the task on', () => {
    const failure = TaskFailure.fromRun('exited');
    const moved = assigned()
      .deferMove(LINE, SPEC, world)
      .moveAsDeferred(
        RUN,
        LINE,
        SPEC,
        TaskRank.of('m'),
        ending(
          ResolvedHandover.failed(
            TaskNoteBody.of('The run failed: exit 1'),
            failure,
          ),
        ),
      );

    const [, passed] = moved.notes;

    expect(passed?.form).toBe('failure');
    expect(passed?.failure).toEqual(failure);
    expect(passed?.body.value).toContain('The run failed: exit 1');
  });

  it('says which run passed it on when a deferred move takes it on', () => {
    const passed = assigned()
      .deferMove(LINE, SPEC, world)
      .moveAsDeferred(
        RUN,
        LINE,
        SPEC,
        TaskRank.of('m'),
        ending(ResolvedHandover.done(TaskNoteBody.of('Done.'))),
      )
      .pullEvents()
      .filter((each) => each instanceof TaskPassed);

    expect(passed).toEqual([
      new TaskPassed(added().id, added().workspaceId, RUN, HERE, SPEC, NOW),
    ]);
  });

  it('counts a failure that repeats one a person already answered when a deferred move takes the task on', () => {
    const exited = TaskFailure.fromRun('exited');
    const again = RunId.of('run_2');
    const answered = assigned()
      .failed(
        exited,
        { ...newNote, body: TaskNoteBody.of('Exit 1.') },
        RUN,
        LINE,
      )
      .answer(NotePosition.of(0), {
        ...newNote,
        body: TaskNoteBody.of('Try again.'),
        voice: Voice.person(UserId.of('user_1')),
      })
      .assignRun(again, LINE);
    answered.pullEvents();

    const moved = answered
      .deferMove(LINE, SPEC, world)
      .moveAsDeferred(
        again,
        LINE,
        SPEC,
        TaskRank.of('m'),
        ending(
          ResolvedHandover.failed(TaskNoteBody.of('Exit 1 again.'), exited),
        ),
      );

    expect(
      moved
        .pullEvents()
        .filter((each) => each instanceof TaskFailed)
        .map((each) => each.failure.occurrences),
    ).toEqual([2]);
    expect(moved.notes[moved.notes.length - 1]?.failure?.occurrences).toBe(2);
  });

  it('is moved for a deferred move only by its current run, and only to where the move was deferred to', () => {
    const noted = assigned().deferMove(LINE, SPEC, world);
    const review = ending(ResolvedHandover.review(TaskNoteBody.of('Look.')));

    expect(() =>
      noted.moveAsDeferred(
        RunId.of('run_9'),
        LINE,
        SPEC,
        TaskRank.of('m'),
        review,
      ),
    ).toThrow(InvalidTaskTransitionError);
    expect(() =>
      noted.moveAsDeferred(RUN, LINE, COMPLETED, TaskRank.of('m'), review),
    ).toThrow(InvalidTaskTransitionError);
    expect(() =>
      assigned().moveAsDeferred(RUN, LINE, SPEC, TaskRank.of('m'), review),
    ).toThrow(InvalidTaskTransitionError);
  });

  describe('while its run waits on a person', () => {
    const paused = () => {
      const task = assigned().putToAPerson(RUN, {
        ...newNote,
        voice: Voice.station(RUN),
      });
      task.pullEvents();
      return task;
    };

    it('defers a move, keeping the run and the question', () => {
      const noted = paused().deferMove(LINE, SPEC, world);

      expect(noted.stationId).toEqual(HERE);
      expect(noted.currentRunId).toEqual(RUN);
      expect(noted.awaitingReview).toBe(true);
      expect(noted.openConversation).toEqual({
        from: NotePosition.of(0),
        to: null,
      });
      expect(noted.deferredMoveTo).toEqual(SPEC);
      expect(noted.pullEvents().map((event) => event.kind)).toEqual([
        'task.noted',
      ]);
    });

    it('cannot be moved by a happening to a station other than the completed one', () => {
      expect(() => paused().react(LINE, SPEC, TaskRank.of('m'), world)).toThrow(
        InvalidTaskTransitionError,
      );
    });

    it('is finished by a happening while it waits on a tool approval', () => {
      const approving = assigned().clearFor(
        ApprovalSubject.toolCall(
          ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
        ),
        ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
        { ...newNote, voice: Voice.station(RUN) },
        RUN,
        null,
      ).task;

      const finished = approving.react(
        LINE,
        COMPLETED,
        TaskRank.of('m'),
        world,
      );

      expect(finished.finished).toBe(true);
      expect(finished.currentRunId).toBeNull();
      expect(finished.awaitingReview).toBe(false);
      expect(finished.decisionPending).toBe(false);
      expect(() =>
        finished.answer(approving.openConversation?.from as NotePosition, {
          ...newNote,
          voice: Voice.person(UserId.of('user_1')),
        }),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('is finished by a happening, closing the question and detaching its run', () => {
      const finished = paused().react(LINE, COMPLETED, TaskRank.of('m'), world);

      expect(finished.stationId).toEqual(COMPLETED);
      expect(finished.finished).toBe(true);
      expect(finished.currentRunId).toBeNull();
      expect(finished.awaitingReview).toBe(false);
      expect(finished.openConversation).toBeNull();
      expect(detached(finished)).toEqual([RUN]);
    });

    it('is moved where a move was deferred to once its run ends without passing it on', () => {
      const moved = paused()
        .deferMove(LINE, SPEC, world)
        .moveAsDeferred(
          RUN,
          LINE,
          SPEC,
          TaskRank.of('m'),
          ending(ResolvedHandover.review(TaskNoteBody.of('Stopped.'))),
        );

      expect(moved.stationId).toEqual(SPEC);
      expect(moved.currentRunId).toBeNull();
      expect(moved.awaitingReview).toBe(false);
    });
  });
});

describe('Task, the station of its notes', () => {
  const SPEC = StationId.of('station_2');

  it('writes a note at the station the task is at', () => {
    const [written] = added().addMessage(newNote).notes;

    expect(written.stationId).toEqual(HERE);
  });

  it('writes a pass at the station the task leaves', () => {
    const passed = added()
      .assignRun(RUN, LINE)
      .passedOn(RUN, LINE, SPEC, TaskRank.of('j'), newNote);

    expect(passed.stationId).toEqual(SPEC);
    expect(passed.notes[passed.notes.length - 1].stationId).toEqual(HERE);
  });
});
