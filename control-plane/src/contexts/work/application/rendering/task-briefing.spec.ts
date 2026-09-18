import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TaskBriefing } from '@work/application/rendering/task-briefing';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import {
  HANDING_OVER,
  OPENING_PULL_REQUESTS,
} from '@work/domain/services/built-in-skills';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { Said } from '@work/domain/value-objects/said.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { describe, expect, it } from 'vitest';

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
    notes: [...task.notes, ...notes].map((each, at) =>
      TaskNote.of({ ...each, position: NotePosition.of(at) }),
    ),
    createdAt: task.createdAt,
    raisedAt: task.raisedAt,
    raisedBy: task.raisedBy,
    pullRequestLink: task.pullRequestLink,
    finishedAt: task.finishedAt,
    attachments: task.attachments,
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
    key: StationKey.of(name.toLowerCase()),
    name: StationName.of(name),
    position,
    color: StationColor.of('#93a1b5'),
    harness: HarnessId.of('dev'),
    agentPrompt: prompt,
    wayOut: WayOut.of({ stations: passesTo.map(StationId.of), ends: finishes }),
  });

const triage = () => at('station_1', 'Triage', 0, undefined, ['station_2']);

const ends = (id: string, name: string, position: number) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(name.toLowerCase()),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    kind: position === 0 ? 'backlog' : 'completed',
  });

const atPlace = (station: Station, position: number) =>
  Station.of({
    id: station.id,
    key: station.key,
    name: station.name,
    position,
    color: station.color,
    description: station.description,
    harness: station.harness,
    agentPrompt: station.agentPrompt,
    kind: station.kind,
    wayOut: station.wayOut,
    tools: station.tools,
    skills: station.skills,
  });

const held = (...stations: Station[]) =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      ends('station_0', 'Backlog', 0),
      ...stations.map((each, place) => atPlace(each, place + 1)),
      ends('station_end', 'Completed', stations.length + 1),
    ],
  });

const task = (stationId: string, description?: TaskDescription) =>
  Task.add({
    line: held(at(stationId, 'Standing', 0)),
    at: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    description,
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: new Date('2026-08-28T09:15:00.000Z'),
    newId: () => 'task_1',
  });

const HANDOVER_SAYS = 'How to write the note, as the handover skill says it.';
const PULL_REQUEST_SAYS = 'How to open one, as the pull-request skill says it.';

const shipped = [
  {
    key: HANDING_OVER.value,
    description: 'Handing over.',
    tools: [],
  },
  {
    key: OPENING_PULL_REQUESTS.value,
    description: 'Opening pull requests.',
    tools: [],
  },
];

const brief = (station: Station, worked?: Task) =>
  TaskBriefing.brief({
    task: worked ?? task(station.id.value),
    line: held(station, at('station_2', 'Spec', 1)),
    skills: shipped,
    listedIn: null,
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
        position: NotePosition.of(0),
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

  it('says where in the workspace each file handed over will be', () => {
    const queue = Attachment.of({
      id: 'file_1',
      name: 'queue.png',
      contentType: 'image/png',
      size: 2048,
    });
    const log = Attachment.of({
      id: 'file_2',
      name: 'trace.log',
      contentType: 'text/plain',
      size: 3 * 1024 * 1024,
    });

    const worked = withNotes(
      Task.add({
        line: held(triage(), at('station_2', 'Spec', 1)),
        at: StationId.of('station_1'),
        title: TaskTitle.of('Fix the queue'),
        attachments: [queue],
        rank: TaskRank.of('i'),
        raisedBy: UserId.of('user_1'),
        now: new Date('2026-08-28T09:15:00.000Z'),
        newId: () => 'task_1',
      }),
      TaskNote.of({
        position: NotePosition.of(0),
        voice: Voice.person(UserId.of('user_1')),
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('Here is the log.'),
        at: new Date('2026-08-28T10:00:00.000Z'),
        kind: 'said',
        attachments: [log],
      }),
    );

    const briefing = brief(triage(), worked);

    expect(briefing).toContain(
      '## Fix the queue\n\nAttached, in the workspace:\n- `.spotlight/attachments/file_1/queue.png` (image/png, 2 KB)',
    );
    expect(briefing).toContain(
      '### Triage\n\nHere is the log.\n\nAttached, in the workspace:\n- `.spotlight/attachments/file_2/trace.log` (text/plain, 3.0 MB)',
    );
  });

  it('says how to declare where the task goes next', () => {
    const briefing = brief(triage());

    expect(briefing).toContain('spotlight handover --next');
    expect(briefing).toContain(
      'names a station to pass the task to, by its key: "spec" (Spec)',
    );
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
    expect(brief(triage())).not.toContain('(Spec), "done"');
  });

  it('does not offer a person among the stations', () => {
    const briefing = brief(triage());

    expect(briefing).not.toContain('(Spec), "review"');
    expect(briefing).toContain('That is not a station');
  });

  it('does not offer the station the task is standing at', () => {
    expect(brief(triage())).not.toContain('"triage"');
  });

  it('tells the agent to ask through the handover, not the terminal', () => {
    const briefing = brief(triage());

    expect(briefing).toContain('Nobody is watching this terminal');
    expect(briefing).toContain('put the question in the note');
  });

  it('says that saying nothing puts the task in front of a person', () => {
    expect(brief(triage())).toContain('puts the task in front of a person');
  });

  describe('the skills a run is given', () => {
    const listed = (station: Station) =>
      TaskBriefing.brief({
        task: task(station.id.value),
        line: held(station, at('station_2', 'Spec', 1)),
        skills: shipped,
        listedIn: '.spotlight/skills',
      });

    it('pastes no skill in, and lists none, where the harness reads them itself', () => {
      const briefing = brief(triage());

      expect(briefing).not.toContain(HANDOVER_SAYS);
      expect(briefing).not.toContain(PULL_REQUEST_SAYS);
      expect(briefing).not.toContain('## Skills');
    });

    it('lists each where it is laid, by what it is for, where the harness does not read them', () => {
      const briefing = listed(triage());

      expect(briefing).toContain('## Skills');
      expect(briefing).toContain(
        '- `.spotlight/skills/spotlight-handover/SKILL.md` — Handing over.',
      );
      expect(briefing).not.toContain(HANDOVER_SAYS);
    });

    it('keeps the station’s own instructions above the skills it lists', () => {
      const briefing = listed(
        at('station_1', 'Triage', 0, AgentPrompt.of('## Role\n\nSort it.'), [
          'station_2',
        ]),
      );

      expect(briefing.indexOf('Sort it.')).toBeLessThan(
        briefing.indexOf('## Skills'),
      );
    });
  });

  describe('what the pull request is waiting to hear back on', () => {
    const heard = (body: string, named: string | null) =>
      TaskNote.of({
        position: NotePosition.of(0),
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

    it('lists where and what without reading the note back', () => {
      const briefing = brief(triage(), reviewed());

      expect(briefing).not.toContain('The pull request was commented on. —');
    });

    it('shows the command with a handle that is actually open', () => {
      expect(brief(triage(), reviewed())).toContain('spotlight reply --to c1');
      expect(brief(triage(), reviewed())).not.toContain('--to c0');
    });

    it('leaves out what was said nowhere answerable', () => {
      expect(brief(triage(), reviewed())).not.toContain('`c0`');
    });

    it('says nothing about answering where there is nothing to answer', () => {
      expect(brief(triage())).not.toContain('## Answering the pull request');
    });
  });
});
