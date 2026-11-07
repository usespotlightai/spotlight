import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const TITLE = 'Set up your team';

const DESCRIPTION =
  'A few quick steps will get everything ready for your team to start working with Spotlight.';

export const welcomeTask = (input: {
  line: LineMap;
  noteBody: TaskNoteBody;
  owner: UserId;
  now: Date;
  newId: () => string;
}): Task =>
  Task.add({
    line: input.line,
    at: input.line.backlog.id,
    title: TaskTitle.of(TITLE),
    description: TaskDescription.of(DESCRIPTION),
    rank: TaskRank.between(null, null),
    createdBy: input.owner,
    now: input.now,
    newId: input.newId,
  }).askedAbout(
    {
      line: input.line,
      body: input.noteBody,
      at: input.now,
      voice: Voice.station(),
      form: 'setup',
    },
    null,
  );
