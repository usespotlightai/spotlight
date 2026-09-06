import { TaskBriefing } from '@application/rendering/task-briefing';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { Said } from '@domain/value-objects/said.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskNote } from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { Tool } from '@domain/value-objects/tool.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

// A task carrying a trail, built the way the repository builds one: the
// aggregate writes its own notes, so nothing may hand it any.
const withNotes = (task: Task, ...notes: TaskNote[]) =>
  Task.rehydrate({
    id: task.id,
    workspaceId: task.workspaceId,
    stationId: task.stationId,
    title: task.title,
    description: task.description,
    rank: task.rank,
    currentRunId: task.currentRunId,
    sessionId: task.sessionId,
    runnerId: task.runnerId,
    notes: [...task.notes, ...notes],
    createdAt: task.createdAt,
    raisedAt: task.raisedAt,
    raisedBy: task.raisedBy,
    repository: task.repository,
    pullRequest: task.pullRequest,
    finishedAt: task.finishedAt,
  });

const at = (
  id: string,
  name: string,
  position: number,
  prompt?: AgentPrompt,
  passesTo: string[] = [],
  finishes = false,
) =>
  Station.of({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#93a1b5'),
    harness: HarnessId.of('dev'),
    agentPrompt: prompt,
    wayOut: WayOut.of({ stations: passesTo.map(StationId.of), ends: finishes }),
  });

const triage = () => at('station_1', 'Triage', 0, undefined, ['station_2']);

// The line a briefing is read out of, since where a task stands and what it
// may be handed on to are both the line's to answer.
const ends = (id: string, name: string, position: number) =>
  Station.of({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    kind: position === 0 ? 'backlog' : 'completed',
  });

const held = (...stations: Station[]) =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: [
      ends('station_0', 'Backlog', 0),
      ...stations.map((each, place) => each.movedTo(place + 1)),
      ends('station_end', 'Completed', stations.length + 1),
    ],
  });

const task = (stationId: string, description?: TaskDescription) =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    description,
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: new Date('2026-08-28T09:15:00.000Z'),
    newId: () => 'task_1',
  });

const brief = (station: Station, worked?: Task) =>
  TaskBriefing.brief({
    task: worked ?? task(station.id.value),
    line: held(station, at('station_2', 'Spec', 1)),
  });

describe('TaskBriefing', () => {
  it('leads with the station’s standing instructions', () => {
    const briefing = brief(
      at('station_1', 'Triage', 0, AgentPrompt.of('## Role\n\nSort it.')),
      task('station_1', TaskDescription.of('It hangs on restart.')),
    );

    expect(briefing).toContain(
      '## Role\n\nSort it.\n\n## Fix the queue\n\nIt hangs on restart.',
    );
  });

  it('lets the task speak for itself at a station with nothing to say', () => {
    expect(brief(triage())).toContain('## Fix the queue');
  });

  it('carries forward what earlier stations left behind', () => {
    const worked = withNotes(
      task('station_1'),

      TaskNote.of({
        voice: Voice.station(),
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('Reproduced on restart.'),
        at: new Date('2026-08-28T10:00:00.000Z'),
        kind: 'passed',
      }),
    );

    expect(brief(triage(), worked)).toContain(
      '## Already done\n\n### Triage\n\nReproduced on restart.',
    );
  });

  it('says how to declare where the task goes next', () => {
    const briefing = brief(triage());

    expect(briefing).toContain('spotlight handover --next');
    expect(briefing).toContain('names a station to pass the task to: "Spec"');
  });

  it('says how to close work only where the station may close it', () => {
    const finishing = at(
      'station_1',
      'Triage',
      0,
      undefined,
      ['station_2'],
      true,
    );

    expect(brief(triage())).not.toContain('--next "done"');
    expect(brief(finishing)).toContain('--next "done"');
  });

  it('does not offer an ending among the stations', () => {
    expect(brief(triage())).not.toContain('"Spec", "done"');
  });

  it('does not offer a person among the stations', () => {
    const briefing = brief(triage());

    expect(briefing).not.toContain('"Spec", "review"');
    expect(briefing).toContain('That is not a station');
  });

  // Handing a task back to where it stands moves nothing and starts the same
  // work again, so the station it is at is never offered.
  it('does not offer the station the task is standing at', () => {
    expect(brief(triage())).not.toContain('"Triage"');
  });

  // An agent at a terminal nobody is watching will wait forever for an answer
  // that is never coming.
  it('tells the agent to ask through the handover, not the terminal', () => {
    const briefing = brief(triage());

    expect(briefing).toContain('Nobody is watching this terminal');
    expect(briefing).toContain('put the question in the note');
  });

  it('says that saying nothing puts the task in front of a person', () => {
    expect(brief(triage())).toContain('puts the task in front of a person');
  });

  describe('what the station can reach for', () => {
    const reaching = (...tools: string[]) =>
      at('station_1', 'Triage', 0, undefined, ['station_2']).reaches(
        tools.map(Tool.of),
      );

    it('says how to use a tool the station has', () => {
      expect(brief(reaching('pull-request'))).toContain(
        'spotlight pull-request --title',
      );
    });

    // What it is not told about, it cannot reach for: the runner raises only
    // what the run was given.
    it('says nothing of a tool the station does not have', () => {
      expect(brief(triage())).not.toContain('spotlight pull-request');
    });

    it('says nothing of a tool nobody here provides', () => {
      expect(() => brief(reaching('teleport'))).not.toThrow();
      expect(brief(reaching('teleport'))).not.toContain('teleport');
    });

    it('keeps the station’s own instructions above what it can reach for', () => {
      const briefing = brief(
        at(
          'station_1',
          'Triage',
          0,
          AgentPrompt.of('## Role\n\nSort the queue.'),
          ['station_2'],
        ).reaches([Tool.of('pull-request')]),
      );

      expect(briefing.indexOf('Sort the queue.')).toBeLessThan(
        briefing.indexOf('spotlight pull-request'),
      );
    });
  });

  describe('what the pull request is waiting to hear back on', () => {
    const heard = (body: string, named: string | null) =>
      TaskNote.of({
        station: StationName.of('Code Review'),
        body: TaskNoteBody.of(body),
        at: new Date('2026-08-31T12:00:00.000Z'),
        voice: Voice.world(),
        said: named
          ? Said.of({
              body: 'pin this.',
              path: 'compose.yml',
              from: 22,
              remark: named,
            })
          : null,
        kind: 'said',
      });

    const reviewed = () =>
      withNotes(
        task('station_1'),
        heard('The pull request was merged.', null),
        heard(
          'The pull request was commented on.\n\ncompose.yml:22\npin this.',
          'PRRC_kwDO',
        ),
      );

    it('names each one the way the agent must name it back', () => {
      const briefing = brief(triage(), reviewed());

      expect(briefing).toContain('## Answering the pull request');
      expect(briefing).toContain('- `c1` — compose.yml:22 — pin this.');
    });

    // Read from what was said, not sliced back out of how it reads: the
    // sentence a note opens with has been reworded more than once.
    it('lists where and what without reading the note back', () => {
      const briefing = brief(triage(), reviewed());

      expect(briefing).not.toContain('The pull request was commented on. —');
    });

    // An example naming a remark that is not open is an example that fails.
    it('shows the command with a handle that is actually open', () => {
      expect(brief(triage(), reviewed())).toContain('spotlight reply --to c1');
      expect(brief(triage(), reviewed())).not.toContain('--to c0');
    });

    // A merge names nothing to answer, so it is not offered as though it did.
    it('leaves out what was said nowhere answerable', () => {
      expect(brief(triage(), reviewed())).not.toContain('`c0`');
    });

    it('says nothing about answering where there is nothing to answer', () => {
      expect(brief(triage())).not.toContain('## Answering the pull request');
    });
  });
});
