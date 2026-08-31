import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { DONE, REVIEW } from '@domain/value-objects/declaration.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';

const closing = (line: AssemblyLine, stationId: StationId): string => {
  // Listing the words that are not places is what makes an agent reach for
  // one meaning a place.
  const named = line
    .optionsFrom(stationId)
    .filter((each) => each !== REVIEW && each !== DONE)
    .map((each) => `"${each}"`)
    .join(', ');

  return [
    '## When you are done',
    'Run this, from anywhere in the workspace:',
    '```\nspotlight handover --next "…" --note "…"\n```',
    `\`--next\` names a station to pass the task to: ${named}. Name somewhere else and the command refuses it and tells you what would have worked, so read what it says and run it again.`,
    `To put the task in front of a person instead of a station, use \`--next "${REVIEW}"\`. That is not a station — it is a person, whatever any station is called — and it is what to use whenever you are unsure.`,
    `Where the work is finished and nothing follows it, use \`--next "${DONE}"\`. That closes the task where it stands: nobody is asked anything, and no station takes it up again. Use it only when there is genuinely nothing left, not to get out of naming somewhere.`,
    '`--note` is what the next station, or the person, needs to know. Keep it short: it is read as instructions, not as a log. A long one is easier piped in, as `spotlight handover --next "…" < note.md`.',
    'Running nothing puts the task in front of a person.',
    'Nobody is watching this terminal. If you need a decision, a missing detail, or an answer before you can finish, do not ask here and wait: hand the task over with `--next "' +
      REVIEW +
      '"` and put the question in the note. Asking at the terminal reaches nobody, and the task stands still until someone notices.',
  ].join('\n\n');
};

export const TaskBriefing = {
  brief(input: { task: Task; line: AssemblyLine }): string {
    const station = input.line.stationAt(input.task.stationId);
    const notes = input.task.notes.map(
      (note) => `### ${note.station.value}\n\n${note.body.value}`,
    );

    return [
      station?.agentPrompt?.value,
      `## ${input.task.title.value}`,
      input.task.description?.value,
      notes.length > 0 ? ['## Already done', ...notes].join('\n\n') : null,
      closing(input.line, input.task.stationId),
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
