import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { feedbackAfter } from '@work/domain/services/feedback-after';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');

const noteOf = (
  position: number,
  body: string,
  voice: Voice,
  kind: 'asked' | 'passed' | 'message' = 'message',
  form: 'words' | 'approval' = 'words',
) =>
  TaskNote.of({
    position: NotePosition.of(position),
    station: StationName.of('Build'),
    body: TaskNoteBody.of(body),
    at: new Date(Date.UTC(2026, 9, 1, 9, position)),
    voice,
    kind,
    form,
  });

const MAYA = Voice.person(UserId.of('user_maya'));

describe('feedbackAfter', () => {
  it('reads the notes of people after the run, up to the next run', () => {
    expect(
      feedbackAfter(
        [
          noteOf(0, 'Before it ran.', MAYA),
          noteOf(1, 'Done: the queue drains.', Voice.station(RUN), 'passed'),
          noteOf(2, 'Retries must back off.', MAYA),
          noteOf(3, 'And log each retry.', MAYA),
          noteOf(4, 'Done again.', Voice.station(RunId.of('run_2')), 'passed'),
          noteOf(5, 'Looks good.', MAYA),
        ],
        RUN,
      ),
    ).toEqual(['Retries must back off.', 'And log each retry.']);
  });

  it('reads nothing for a run that left no note', () => {
    expect(feedbackAfter([noteOf(0, 'Hello.', MAYA)], RUN)).toEqual([]);
  });

  it('keeps reading past the notes of the world or the station, but not past an approval', () => {
    expect(
      feedbackAfter(
        [
          noteOf(0, 'Done.', Voice.station(RUN), 'passed'),
          noteOf(1, 'Slack: build red.', Voice.world()),
          noteOf(2, 'Moved to Build.', Voice.station()),
          noteOf(3, 'Approve the deploy?', MAYA, 'message', 'approval'),
          noteOf(4, 'Keep the old API.', MAYA),
        ],
        RUN,
      ),
    ).toEqual(['Keep the old API.']);
  });

  it('reads after the run’s last note, when it wrote more than one note', () => {
    expect(
      feedbackAfter(
        [
          noteOf(0, 'Which queue?', Voice.station(RUN), 'asked'),
          noteOf(1, 'The billing one.', MAYA),
          noteOf(2, 'Done.', Voice.station(RUN), 'passed'),
          noteOf(3, 'Too slow.', MAYA),
        ],
        RUN,
      ),
    ).toEqual(['Too slow.']);
  });
});
