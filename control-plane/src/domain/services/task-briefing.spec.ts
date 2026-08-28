import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import { TaskBriefing } from '@domain/services/task-briefing';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskNote } from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const station = (agentPrompt?: AgentPrompt) =>
  Station.create({
    id: StationId.of('station_1'),
    name: StationName.of('Triage'),
    position: 1,
    color: StationColor.of('#93a1b5'),
    agentPrompt,
  });

const task = (description?: TaskDescription) =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    description,
    rank: TaskRank.of('i'),
    now: new Date('2026-08-28T09:15:00.000Z'),
    newId: () => 'task_1',
  });

describe('TaskBriefing', () => {
  it('leads with the station’s standing instructions', () => {
    const brief = TaskBriefing.brief(
      station(AgentPrompt.of('## Role\n\nSort the queue.')),
      task(TaskDescription.of('It hangs on restart.')),
    );

    expect(brief).toBe(
      '## Role\n\nSort the queue.\n\n## Fix the queue\n\nIt hangs on restart.',
    );
  });

  it('lets the task speak for itself at a station with nothing to say', () => {
    expect(TaskBriefing.brief(station(), task())).toBe('## Fix the queue');
  });

  it('carries forward what earlier stations left behind', () => {
    const worked = task()
      .note(
        TaskNote.of({
          station: StationName.of('Triage'),
          body: TaskNoteBody.of('Reproduced on restart.'),
          at: new Date('2026-08-28T10:00:00.000Z'),
        }),
      )
      .note(
        TaskNote.of({
          station: StationName.of('Spec'),
          body: TaskNoteBody.of('Drain the queue on shutdown.'),
          at: new Date('2026-08-28T11:00:00.000Z'),
        }),
      );

    expect(TaskBriefing.brief(station(), worked)).toBe(
      [
        '## Fix the queue',
        '## Already done',
        '### Triage',
        'Reproduced on restart.',
        '### Spec',
        'Drain the queue on shutdown.',
      ].join('\n\n'),
    );
  });

  it('carries a description even where the station is silent', () => {
    expect(
      TaskBriefing.brief(station(), task(TaskDescription.of('Steps here.'))),
    ).toBe('## Fix the queue\n\nSteps here.');
  });
});
