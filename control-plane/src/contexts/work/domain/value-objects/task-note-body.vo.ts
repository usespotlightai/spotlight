import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { InvalidTaskNoteError } from '@work/domain/exceptions/invalid-task-note.error';
import type { Anchor } from '@work/domain/value-objects/anchor.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { HandoverOption } from '@work/domain/value-objects/handover-option.vo';

const resumeWord = (
  option: HandoverOption,
  here: StationName,
): string | null => {
  if (option.kind === 'done') {
    return `  - \`"${option.word}"\`: the task is finished. Use it only when they say the task is finished.`;
  }

  if (!option.station) {
    return null;
  }

  return option.station.name.equals(here)
    ? `  - \`"${option.word}"\`: ${here.value} continues the work.`
    : `  - \`"${option.word}"\`: the task moves on to ${option.station.name.value}.`;
};

const driverRules = (
  here: StationName,
  options: readonly HandoverOption[],
): string =>
  [
    '- Do what they ask in each message, and nothing more.',
    '- Commit your changes at the end of each turn, with a short message that says what changed.',
    '- Do not push or open a pull request unless they ask for it.',
    '- When a turn is done, say in a few sentences what you changed, then stop and wait for the next message.',
    '- When a message says that the line can carry on, do the rest of what it asks. Then give the task back to the line with `spotlight handover --next "…" --note "…"`. `--next` says where the task goes:',
    ...options.flatMap((each) => resumeWord(each, here) ?? []),
    '  `--note` tells the line what changed in these turns, and why.',
    '- In all other cases, do not run `spotlight handover`.',
  ].join('\n');

export const drivenByAPerson = (
  here: StationName,
  options: readonly HandoverOption[],
): string =>
  [
    '## People drive this session',
    'A person put the task on hold. The line waits. People on the team now send the messages. Each message is one turn.',
    driverRules(here, options),
  ].join('\n\n');

export class TaskNoteBody {
  private static readonly TURNS_ARE_OVER =
    "The rules for people's turns no longer apply.";

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

  static branchPullRequest(pullRequest: PullRequestUrl): TaskNoteBody {
    return TaskNoteBody.of(
      `Pull request ${pullRequest.value} is open from the branch of this task. It is now the pull request of the task.`,
    );
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

  static putOnHold(
    at: StationName,
    options: readonly HandoverOption[],
  ): TaskNoteBody {
    return TaskNoteBody.of(
      `A person put the task on hold at ${at.value}. The line waits. From now on people on the team drive this session, turn by turn.\n${driverRules(at, options)}`,
    );
  }

  static heldForChat(at: StationName): TaskNoteBody {
    return TaskNoteBody.of(
      `An agent chat works on this task at ${at.value} and opens its pull request. The line waits while the chat works on it. Events about the pull request go to the chat. When the person hands the task to the line, the line resumes here.`,
    );
  }

  static leftChat(at: {
    name: StationName;
    isCompleted: boolean;
    isBacklog: boolean;
  }): TaskNoteBody {
    const moved = at.isCompleted
      ? `The person moved the task to ${at.name.value}, so the task is done.`
      : at.isBacklog
        ? `The person moved the task to ${at.name.value}. It waits there until someone starts it.`
        : `The person handed the task to the line. It is at ${at.name.value}, and the line works on it from now on.`;

    return TaskNoteBody.of(
      `${moved} Do not push to its branch again. When the person asks for more changes, make them on a new branch.`,
    );
  }

  static movesOnResume(to: StationName, account: TaskNoteBody): TaskNoteBody {
    return TaskNoteBody.of(
      `This arrived while the task was on hold. The task moves to ${to.value} when the line resumes, unless a later event asks for another move.\n\n${account.value}`,
    );
  }

  static movesAfterHold(to: StationName): TaskNoteBody {
    return TaskNoteBody.of(
      `An event arrived while the task was on hold, and it asks to move the task to ${to.value}. If the next run does not pass the task on, the task moves to ${to.value} when that run ends.`,
    );
  }

  static resumed(input: {
    at: StationName;
    into: { name: StationName; completed: boolean } | null;
    held: StationName | null;
    changes: readonly { path: string; from: string; to: string }[];
    summary: string | null;
  }): TaskNoteBody {
    const changed = input.changes.filter((each) => each.from !== each.to);

    return TaskNoteBody.of(
      [
        `The line resumed at ${input.at.value}. ${TaskNoteBody.resumedInto(input.into)}`,
        TaskNoteBody.heldMoveOnResume(input.into, input.held),
        input.summary ? `About the changes:\n\n${input.summary}` : null,
        changed.length > 0
          ? [
              "The changes from the person's turns are committed in the workspace. Read them with:",
              changed
                .map(
                  (each) =>
                    `- \`git -C ${each.path} diff ${each.from}..${each.to}\``,
                )
                .join('\n'),
            ].join('\n\n')
          : "Read the changes from the person's turns with `git diff` and `git log` in the workspace.",
        'Keep these changes unless the station instructions require otherwise.',
      ]
        .filter(Boolean)
        .join('\n\n'),
    );
  }

  private static resumedInto(
    into: { name: StationName; completed: boolean } | null,
  ): string {
    if (!into) {
      return `It stays here. ${TaskNoteBody.TURNS_ARE_OVER} Go on with the work of this station as your first instructions said, and hand over when you are done.`;
    }

    return into.completed
      ? 'The task is finished.'
      : `It moved on to ${into.name.value}. ${TaskNoteBody.TURNS_ARE_OVER} Work as your station instructions say, and hand over when you are done.`;
  }

  private static heldMoveOnResume(
    into: { name: StationName } | null,
    held: StationName | null,
  ): string | null {
    if (!into || !held) {
      return null;
    }

    return held.equals(into.name)
      ? 'An event asked for this move while the task was on hold.'
      : `An event asked to move the task to ${held.value} while the task was on hold. That move did not happen, because the person chose where the task goes.`;
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
