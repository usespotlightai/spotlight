import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { type Outcome, ReactionFor } from '@work/domain/services/reaction-for';
import { Approval } from '@work/domain/value-objects/approval.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Happening, type Word } from '@work/domain/value-objects/happening.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { Said } from '@work/domain/value-objects/said.vo';
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

const NOW = new Date('2026-09-29T12:00:00.000Z');
const RUN = RunId.of('run_1');

const MERGED = Happening.of('github.pull_request.merged');
const COMMENTED = Happening.of('github.pull_request.commented');
const CLOSED = Happening.of('github.pull_request.closed-unmerged');

const at = (
  id: string,
  name: string,
  position: number,
  kind: 'backlog' | 'work' | 'completed' = 'work',
) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(name.toLowerCase().split(' ').join('-')),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness: kind === 'work' ? HarnessId.of('dev') : undefined,
    kind,
  });

const LINE = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    at('station_0', 'Backlog', 0, 'backlog'),
    at('station_1', 'Implementation', 1),
    at('station_2', 'Code Review', 2),
    at('station_3', 'Completed', 3, 'completed'),
  ],
  reactions: [
    Reaction.of({
      happening: COMMENTED,
      from: null,
      to: StationId.of('station_2'),
    }),
    Reaction.of({
      happening: MERGED,
      from: null,
      to: StationId.of('station_3'),
    }),
    Reaction.of({
      happening: CLOSED,
      from: null,
      to: StationId.of('station_3'),
    }),
  ],
});

const standing = (stationId: string) =>
  Task.add({
    line: LINE,
    at: StationId.of(stationId),
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    now: NOW,
    newId: () => 'task_1',
  });

const word = (happening: Happening, told: string): Word => ({
  happening,
  told,
  spoken: happening.equals(COMMENTED),
  state: 'raised',
});

const merged = word(MERGED, 'The pull request was merged.');
const commented = word(COMMENTED, 'The pull request was commented on.');

const reaction = (task: Task, heard: Word, said: Said | null = null) =>
  ReactionFor.happened({ task, line: LINE, word: heard, said });

const destination = (outcome: Outcome) =>
  outcome.kind === 'moves' || outcome.kind === 'heldBack'
    ? outcome.to.id
    : null;

const held = (stationId: string) => standing(stationId).handedTo(RUN, LINE);

const paused = (stationId: string) =>
  held(stationId).putToAPersonBy(RUN, {
    station: StationName.of('Implementation'),
    body: TaskNoteBody.of('Which queue should I drain?'),
    at: NOW,
    voice: Voice.station(RUN),
  });

describe('ReactionFor.happened', () => {
  it('moves a task no run holds to the station the rule names', () => {
    const outcome = reaction(standing('station_1'), commented);

    expect(outcome.kind).toBe('moves');
    expect(destination(outcome)).toEqual(StationId.of('station_2'));
  });

  it('moves a task no run holds to the end of the line when the pull request merges', () => {
    const outcome = reaction(standing('station_1'), merged);

    expect(outcome.kind).toBe('moves');
    expect(destination(outcome)).toEqual(StationId.of('station_3'));
  });

  it('holds back a move while a run holds the task, noted where the task stands', () => {
    const outcome = reaction(
      held('station_1'),
      commented,
      Said.of({ body: 'This retries forever.', path: 'upload.ts', from: 12 }),
    );

    expect(outcome.kind).toBe('heldBack');
    expect(destination(outcome)).toEqual(StationId.of('station_2'));
    expect(outcome).toMatchObject({
      station: StationName.of('Implementation'),
    });
  });

  it('notes what was heard while a run held the task, and where it moves once the run ends', () => {
    const said = Said.of({ body: 'This retries forever.' });
    const outcome = reaction(held('station_1'), commented, said);

    expect(outcome.kind === 'heldBack' && outcome.body.value).toBe(
      'Heard while a run held the task. It moves to Code Review when the run ends, unless the run passes it on:\n\nThis retries forever.',
    );
    expect(outcome.kind === 'heldBack' && outcome.said).toBe(said);
  });

  it('holds back a spoken word with nothing said as what happened', () => {
    const outcome = reaction(held('station_1'), commented);

    expect(outcome.kind === 'heldBack' && outcome.body.value).toContain(
      'unless the run passes it on:\n\nThe pull request was commented on.',
    );
  });

  it('interrupts the run and puts it to a person where a merge would finish the task a run holds', () => {
    const outcome = reaction(held('station_2'), merged);

    expect(outcome.kind).toBe('interrupts');
    expect(outcome).toMatchObject({ station: StationName.of('Code Review') });
    expect(outcome.kind === 'interrupts' && outcome.body.value).toBe(
      'The pull request was merged while Code Review was working. Close the task, or reply to carry on.',
    );
  });

  it('says what closed the pull request when it interrupts a run', () => {
    const outcome = reaction(
      held('station_1'),
      word(CLOSED, 'The pull request was closed without being merged.'),
    );

    expect(outcome.kind === 'interrupts' && outcome.body.value).toBe(
      'The pull request was closed without being merged while Implementation was working. Close the task, or reply to carry on.',
    );
  });

  it('holds back a move while the run holding the task waits on a person', () => {
    const outcome = reaction(paused('station_1'), commented);

    expect(outcome.kind).toBe('heldBack');
    expect(destination(outcome)).toEqual(StationId.of('station_2'));
  });

  it('adds to the question instead of asking again where a merge would finish a task whose run waits on a person', () => {
    const outcome = reaction(paused('station_2'), merged);

    expect(outcome.kind).toBe('interrupts');
    expect(outcome.kind === 'interrupts' && outcome.body.value).toBe(
      'The pull request was merged while Code Review was waiting for an answer. Close the task, or reply to carry on.',
    );
  });

  it('says the station was working where the task awaits only a tool approval', () => {
    const asking = held('station_2').putToAPersonBy(RUN, {
      station: StationName.of('Code Review'),
      body: TaskNoteBody.of('Approve linear.comment?'),
      at: NOW,
      voice: Voice.station(RUN),
      form: 'approval',
      approval: Approval.asked(
        ApprovalSubject.toolCall(
          ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
        ),
        StationId.of('station_2'),
        'It posts publicly.',
        null,
      ),
    });

    const outcome = reaction(asking, merged);

    expect(outcome.kind === 'interrupts' && outcome.body.value).toBe(
      'The pull request was merged while Code Review was working. Close the task, or reply to carry on.',
    );
  });

  it('names no station of the line when the task a merge interrupts stands on none of it', () => {
    const elsewhere = Line.rehydrate({
      id: LineId.of('line_9'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      key: LineKey.of('elsewhere'),
      name: LineName.of('Elsewhere'),
      stations: [
        at('station_8', 'Backlog', 0, 'backlog'),
        at('station_9', 'Triage', 1),
        at('station_10', 'Completed', 2, 'completed'),
      ],
    });
    const task = Task.add({
      line: elsewhere,
      at: StationId.of('station_9'),
      title: TaskTitle.of('Retry uploads'),
      rank: TaskRank.of('i'),
      now: NOW,
      newId: () => 'task_9',
    }).handedTo(RUN, elsewhere);

    const outcome = reaction(task, merged);

    expect(outcome.kind === 'interrupts' && outcome.body.value).toBe(
      'The pull request was merged while its station was working. Close the task, or reply to carry on.',
    );
  });

  it('keeps a task where the rule names the station it stands at, run or no run', () => {
    const said = Said.of({ body: 'Pin it to a version.' });

    expect(reaction(standing('station_2'), commented, said).kind).toBe('stays');
    expect(reaction(held('station_2'), commented, said).kind).toBe('stays');
  });

  it('says nothing to a task that has landed at the end of the line', () => {
    expect(reaction(standing('station_3'), merged).kind).toBe('nothing');
  });
});
