import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { OpenRemark, Task } from '@domain/aggregates/task.aggregate';
import type { Station } from '@domain/entities/station.entity';
import { toolNamed } from '@domain/services/built-in-tools';
import { DONE, REVIEW } from '@domain/value-objects/declaration.vo';
import { RemarkHandle } from '@domain/value-objects/remark-handle.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';

const closing = (line: AssemblyLine, stationId: StationId): string => {
  const offered = line.optionsFrom(stationId);
  // Listing the words that are not places is what makes an agent reach for
  // one meaning a place.
  const named = offered
    .map((each) => each.value)
    .filter((each) => each !== REVIEW && each !== DONE)
    .map((each) => `"${each}"`)
    .join(', ');

  return [
    '## When you are done',
    'Run this, from anywhere in the workspace:',
    '```\nspotlight handover --next "…" --note "…"\n```',
    `\`--next\` names a station to pass the task to: ${named}. Name somewhere else and the command refuses it and tells you what would have worked, so read what it says and run it again.`,
    `To put the task in front of a person instead of a station, use \`--next "${REVIEW}"\`. That is not a station — it is a person, whatever any station is called — and it is what to use whenever you are unsure.`,
    offered.some((each) => each.value === DONE)
      ? `Where the work is finished and nothing follows it, use \`--next "${DONE}"\`. That closes the task where it stands: nobody is asked anything, and no station takes it up again. Use it only when there is genuinely nothing left, not to get out of naming somewhere.`
      : null,
    '`--note` is what the next station, or the person, needs to know. Keep it short: it is read as instructions, not as a log. A long one is easier piped in, as `spotlight handover --next "…" < note.md`.',
    'Running nothing puts the task in front of a person.',
    'Nobody is watching this terminal. If you need a decision, a missing detail, or an answer before you can finish, do not ask here and wait: hand the task over with `--next "' +
      REVIEW +
      '"` and put the question in the note. Asking at the terminal reaches nobody, and the task stands still until someone notices.',
  ]
    .filter(Boolean)
    .join('\n\n');
};

/**
 * What the pull request is still waiting to hear back on. Named here rather
 * than in the note, so a person reading the trail is not shown a handle only
 * an agent has any use for.
 */
const answering = (task: Task): string | null => {
  const open = task.openRemarks;

  if (open.length === 0) {
    return null;
  }

  const listed = open.map((each) =>
    [
      `- \`${RemarkHandle.for(each.at)}\``,
      each.said.place,
      each.said.body || null,
    ]
      .filter(Boolean)
      .join(' — '),
  );

  // Named from what is actually open, so the example is a command that works.
  const one = RemarkHandle.for((open[0] as OpenRemark).at);

  return [
    '## Answering the pull request',
    'These were said on the pull request and nobody has answered them:',
    ...listed,
    'Run this to answer one, from anywhere in the workspace:',
    `\`\`\`\nspotlight reply --to ${one} --body "…"\n\`\`\``,
    'Add `--resolve` to resolve the thread as well, where you have addressed what it asked. Leave it off where you are disagreeing or asking something back.',
    `A long answer is easier piped in, as \`spotlight reply --to ${one} < answer.md\`.`,
    'Answer only what you have something to say about. What you leave alone stays open for whoever picks the task up next.',
  ].join('\n\n');
};

/**
 * How to use what this station has. Told about here and nowhere else: a
 * station without the tool is not told about it, and what it does not know
 * about it cannot reach for.
 */
const reaching = (station: Station | null): string | null => {
  const told = (station?.tools ?? [])
    .map((each) => toolNamed(each)?.instructions)
    .filter((each): each is string => Boolean(each));

  return told.length > 0 ? told.join('\n\n') : null;
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
      reaching(station),
      answering(input.task),
      closing(input.line, input.task.stationId),
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
