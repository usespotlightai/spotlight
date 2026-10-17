import { InvalidTaskNoteError } from '@work/domain/exceptions/invalid-task-note.error';
import type { Anchor } from '@work/domain/value-objects/anchor.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
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

  static receivedHappening(
    summary: string,
    anchor: Anchor | null,
  ): TaskNoteBody {
    const anchored = [anchor?.place, anchor?.body].filter(Boolean).join('\n');

    return TaskNoteBody.of(anchored || summary);
  }

  static deferredMove(
    summary: string,
    anchor: Anchor | null,
    to: StationName,
  ): TaskNoteBody {
    return TaskNoteBody.of(
      `This arrived while a run worked on the task. If the run does not pass the task on, the task moves to ${to.value} when the run ends.\n\n${TaskNoteBody.receivedHappening(summary, anchor).value}`,
    );
  }

  static movedAsDeferred(
    to: StationName,
    account: TaskNoteBody | null,
  ): TaskNoteBody {
    const moved = `Moved to ${to.value} when the run ended. An event arrived while the run worked.`;

    return TaskNoteBody.of(account ? `${moved}\n\n${account.value}` : moved);
  }

  static interrupted(
    summary: string,
    working: StationName | null,
  ): TaskNoteBody {
    return TaskNoteBody.happenedWhile(summary, working, 'was working');
  }

  static interruptedWhileWaiting(
    summary: string,
    waiting: StationName | null,
  ): TaskNoteBody {
    return TaskNoteBody.happenedWhile(
      summary,
      waiting,
      'was waiting for an answer',
    );
  }

  private static happenedWhile(
    summary: string,
    station: StationName | null,
    doing: string,
  ): TaskNoteBody {
    const happened = TaskNoteBody.of(summary).value.replace(/\.$/, '');

    return TaskNoteBody.of(
      `${happened} while ${station?.value ?? 'its station'} ${doing}. Close the task, or reply to carry on.`,
    );
  }

  static fromInput(
    raw: string,
    attachments: readonly Attachment[] = [],
  ): TaskNoteBody {
    const names = attachments.map((each) => each.name).join(', ');

    return TaskNoteBody.of(raw.trim() || (names ? `Attached ${names}.` : ''));
  }

  static fromHook(hook: string, text: string): TaskNoteBody {
    return TaskNoteBody.of(
      `From the hook ${hook}:\n\n${TaskNoteBody.of(text).value}`,
    );
  }

  static movedTo(station: StationName): TaskNoteBody {
    return TaskNoteBody.of(`Moved to ${station.value}.`);
  }

  equals(other: TaskNoteBody): boolean {
    return this.value === other.value;
  }
}
