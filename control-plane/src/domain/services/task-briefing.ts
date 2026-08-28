import type { Task } from '@domain/aggregates/task.aggregate';
import type { Station } from '@domain/entities/station.entity';
import { handoverOptions } from '@domain/services/handover-options';
import { REVIEW } from '@domain/value-objects/declaration.vo';

const closing = (station: Station, stations: readonly Station[]): string => {
  const named = handoverOptions(stations, station.id)
    .map((each) => `"${each}"`)
    .join(', ');

  return [
    '## When you are done',
    'Run this, from anywhere in the workspace:',
    '```\nspotlight handover --next "…" --note "…"\n```',
    `\`--next\` is one of ${named}. Use "${REVIEW}" to put the task in front of a person, and use it whenever you are unsure. Name somewhere else and the command refuses it and tells you what would have worked, so read what it says and run it again.`,
    '`--note` is what the next station, or the person, needs to know. Keep it short: it is read as instructions, not as a log. A long one is easier piped in, as `spotlight handover --next "…" < note.md`.',
    'Running nothing puts the task in front of a person.',
    'Nobody is watching this terminal. If you need a decision, a missing detail, or an answer before you can finish, do not ask here and wait: hand the task over with `--next "' +
      REVIEW +
      '"` and put the question in the note. Asking at the terminal reaches nobody, and the task stands still until someone notices.',
  ].join('\n\n');
};

export const TaskBriefing = {
  brief(input: {
    station: Station;
    task: Task;
    stations: readonly Station[];
  }): string {
    const notes = input.task.notes.map(
      (note) => `### ${note.station.value}\n\n${note.body.value}`,
    );

    return [
      input.station.agentPrompt?.value,
      `## ${input.task.title.value}`,
      input.task.description?.value,
      notes.length > 0 ? ['## Already done', ...notes].join('\n\n') : null,
      closing(input.station, input.stations),
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
