import { Task } from '@domain/aggregates/task.aggregate';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import type { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

const TITLE = 'Set up your team';

const DESCRIPTION =
  'A few quick steps will get everything ready for your team to start working with Spotlight.';

export const welcomeTask = (input: {
  workspaceId: WorkspaceId;
  teamId: TeamId;
  saying: TaskNoteBody;
  stationId: StationId;
  station: StationName;
  owner: UserId;
  now: Date;
  newId: () => string;
}): Task =>
  Task.add({
    workspaceId: input.workspaceId,
    stationId: input.stationId,
    title: TaskTitle.of(TITLE),
    description: TaskDescription.of(DESCRIPTION),
    rank: TaskRank.between(null, null),
    raisedBy: input.owner,
    now: input.now,
    newId: input.newId,
  }).askedAbout({
    station: input.station,
    body: input.saying,
    at: input.now,
    voice: Voice.station(),
    form: 'setup',
  });
