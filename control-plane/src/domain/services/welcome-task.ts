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

/**
 * What a team is told the moment it is opened, in the inbox of whoever opened
 * it. A task rather than a screen of its own, because that is what Spotlight
 * already has for a thing waiting on a person. The words it carries are the
 * caller's; which steps there are is not.
 */
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
    // Nobody's run said this. The board did, the way it does when it moves
    // something without a person touching it.
    voice: Voice.station(),
    form: 'setup',
  });
