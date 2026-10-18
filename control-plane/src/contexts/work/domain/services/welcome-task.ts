import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const TITLE = 'Set up your team';

const DESCRIPTION =
  'A few quick steps will get everything ready for your team to start working with Spotlight.';

export const welcomeTask = (input: {
  line: Line;
  teamId: TeamId;
  noteBody: TaskNoteBody;
  at: StationId;
  station: StationName;
  owner: UserId;
  now: Date;
  newId: () => string;
}): Task =>
  Task.add({
    line: input.line,
    at: input.at,
    title: TaskTitle.of(TITLE),
    description: TaskDescription.of(DESCRIPTION),
    rank: TaskRank.between(null, null),
    createdBy: input.owner,
    now: input.now,
    newId: input.newId,
  }).askedAbout(
    {
      station: input.station,
      body: input.noteBody,
      at: input.now,
      voice: Voice.station(),
      form: 'setup',
    },
    null,
  );
