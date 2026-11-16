import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { InvalidTaskNoteError } from '@work/domain/exceptions/invalid-task-note.error';
import type { Anchor } from '@work/domain/value-objects/anchor.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';

export const DRIVER_RULES = [
  '- Do what they ask in each message, and nothing more.',
  '- Commit your changes at the end of each turn, with a short message that says what changed.',
  '- Do not run `spotlight handover`. The person gives the task back to the line when they are done.',
  '- Do not push or open a pull request unless they ask for it.',
  '- When a turn is done, say in a few sentences what you changed, then stop and wait for the next message.',
].join('\n');

export const DRIVEN_BY_A_PERSON = [
  '## A person drives this session',
  'A person took the task over from the line. Each of their messages is one turn. They hand the task back to the line when they are done.',
  DRIVER_RULES,
].join('\n\n');

export class TaskNoteBody {
  private static readonly TURNS_ARE_OVER =
    'The rules for their turns no longer apply.';

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

  static heldMove(to: StationName, account: TaskNoteBody): TaskNoteBody {
    return TaskNoteBody.of(
      `The task has another open pull request. It moves to ${to.value} when its last pull request closes.\n\n${account.value}`,
    );
  }

  static movedWhenPullRequestsClosed(to: StationName): TaskNoteBody {
    return TaskNoteBody.of(
      `Moved to ${to.value} when the last pull request of the task closed.`,
    );
  }

  static deferredMove(to: StationName, account: TaskNoteBody): TaskNoteBody {
    return TaskNoteBody.of(
      `This arrived while a run was in progress on the task. If the run does not pass the task on, the task moves to ${to.value} when the run ends.\n\n${account.value}`,
    );
  }

  static movedAsDeferred(
    to: StationName,
    account: TaskNoteBody | null,
  ): TaskNoteBody {
    const moved = `Moved to ${to.value} when the run ended. An event arrived while the run was in progress.`;

    return TaskNoteBody.of(account ? `${moved}\n\n${account.value}` : moved);
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

  static tookOver(at: StationName): TaskNoteBody {
    return TaskNoteBody.of(
      `A person took over the task at ${at.value}. From now on they drive this session, turn by turn.\n${DRIVER_RULES}`,
    );
  }

  static heldForTakeover(to: StationName, account: TaskNoteBody): TaskNoteBody {
    return TaskNoteBody.of(
      `This arrived while a person had the task. The task moves to ${to.value} when they hand it back to the line, unless a later event asks for another move.\n\n${account.value}`,
    );
  }

  static movesAfterTakeover(to: StationName): TaskNoteBody {
    return TaskNoteBody.of(
      `An event arrived while a person had the task, and it asks to move the task to ${to.value}. If the next run does not pass the task on, the task moves to ${to.value} when that run ends.`,
    );
  }

  static handedBack(input: {
    at: StationName;
    into: { name: StationName; completed: boolean } | null;
    held: StationName | null;
    changes: readonly { path: string; from: string; to: string }[];
    summary: string | null;
  }): TaskNoteBody {
    const changed = input.changes.filter((each) => each.from !== each.to);

    return TaskNoteBody.of(
      [
        `The person handed the task back to the line at ${input.at.value}. ${TaskNoteBody.handedBackInto(input.into)}`,
        TaskNoteBody.heldMoveAtHandBack(input.into, input.held),
        input.summary ? `What they said:\n\n${input.summary}` : null,
        changed.length > 0
          ? [
              'Their changes are committed in the workspace. Read them with:',
              changed
                .map(
                  (each) =>
                    `- \`git -C ${each.path} diff ${each.from}..${each.to}\``,
                )
                .join('\n'),
            ].join('\n\n')
          : 'Read their changes with `git diff` and `git log` in the workspace.',
        'Keep what they changed unless the station instructions require otherwise.',
      ]
        .filter(Boolean)
        .join('\n\n'),
    );
  }

  private static handedBackInto(
    into: { name: StationName; completed: boolean } | null,
  ): string {
    if (!into) {
      return `It stays here. ${TaskNoteBody.TURNS_ARE_OVER} Go on with the work of this station as your first instructions said, and hand over when you are done.`;
    }

    return into.completed
      ? 'The task is finished.'
      : `It moved on to ${into.name.value}. ${TaskNoteBody.TURNS_ARE_OVER} Work as your station instructions say, and hand over when you are done.`;
  }

  private static heldMoveAtHandBack(
    into: { name: StationName } | null,
    held: StationName | null,
  ): string | null {
    if (!into || !held) {
      return null;
    }

    return held.equals(into.name)
      ? `An event asked for this move while the person had the task.`
      : `An event asked to move the task to ${held.value} while the person had it. That move did not happen, because the person chose where the task goes.`;
  }

  static movedTo(station: StationName): TaskNoteBody {
    return TaskNoteBody.of(`Moved to ${station.value}.`);
  }

  static connected(providedBy: string): TaskNoteBody {
    return TaskNoteBody.of(`Connected ${providedBy}.`);
  }

  equals(other: TaskNoteBody): boolean {
    return this.value === other.value;
  }
}
