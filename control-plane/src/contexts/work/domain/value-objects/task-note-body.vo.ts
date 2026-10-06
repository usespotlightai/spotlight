import { InvalidTaskNoteError } from '@work/domain/exceptions/invalid-task-note.error';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { Said } from '@work/domain/value-objects/said.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';

export class TaskNoteBody {
  private constructor(readonly value: string) {}

  static of(raw: string): TaskNoteBody {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidTaskNoteError('must not be empty');
    }

    return new TaskNoteBody(trimmed);
  }

  static heard(told: string, said: Said | null): TaskNoteBody {
    const spoken = [said?.place, said?.body].filter(Boolean).join('\n');

    return TaskNoteBody.of(spoken || told);
  }

  static heldBack(
    told: string,
    said: Said | null,
    to: StationName,
  ): TaskNoteBody {
    return TaskNoteBody.of(
      `Heard while a run held the task. It moves to ${to.value} when the run ends, unless the run passes it on.\n\n${TaskNoteBody.heard(told, said).value}`,
    );
  }

  static movedAsHeldBack(
    to: StationName,
    account: TaskNoteBody | null,
  ): TaskNoteBody {
    const moved = `Moved to ${to.value} when the run ended. An event arrived while the run worked.`;

    return TaskNoteBody.of(account ? `${moved}\n\n${account.value}` : moved);
  }

  static interrupted(told: string, working: StationName | null): TaskNoteBody {
    return TaskNoteBody.happenedWhile(told, working, 'was working');
  }

  static interruptedWhileWaiting(
    told: string,
    waiting: StationName | null,
  ): TaskNoteBody {
    return TaskNoteBody.happenedWhile(
      told,
      waiting,
      'was waiting for an answer',
    );
  }

  private static happenedWhile(
    told: string,
    station: StationName | null,
    doing: string,
  ): TaskNoteBody {
    const happened = TaskNoteBody.of(told).value.replace(/\.$/, '');

    return TaskNoteBody.of(
      `${happened} while ${station?.value ?? 'its station'} ${doing}. Close the task, or reply to carry on.`,
    );
  }

  static given(
    raw: string,
    attachments: readonly Attachment[] = [],
  ): TaskNoteBody {
    const names = attachments.map((each) => each.name).join(', ');

    return TaskNoteBody.of(raw.trim() || (names ? `Attached ${names}.` : ''));
  }

  static fromHook(hook: string, said: string): TaskNoteBody {
    return TaskNoteBody.of(
      `From the hook ${hook}:\n\n${TaskNoteBody.of(said).value}`,
    );
  }

  static movedTo(station: StationName): TaskNoteBody {
    return TaskNoteBody.of(`Moved to ${station.value}.`);
  }

  equals(other: TaskNoteBody): boolean {
    return this.value === other.value;
  }
}
