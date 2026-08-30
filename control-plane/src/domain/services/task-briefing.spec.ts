import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import { TaskBriefing } from '@domain/services/task-briefing';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskNote } from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const at = (id: string, name: string, position: number, prompt?: AgentPrompt) =>
  Station.create({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#93a1b5'),
    agentPrompt: prompt,
  });

const triage = () => at('station_1', 'Triage', 0);

// The line a briefing is read out of, since where a task stands and what it
// may be handed on to are both the line's to answer.
const held = (...stations: Station[]) =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations,
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
    expect(brief(at('station_1', 'Triage', 0))).toContain('## Fix the queue');
  });

  it('carries forward what earlier stations left behind', () => {
    const worked = task('station_1').note(
      TaskNote.of({
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('Reproduced on restart.'),
        at: new Date('2026-08-28T10:00:00.000Z'),
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
});
