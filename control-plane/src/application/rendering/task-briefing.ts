import { Attached } from '@application/rendering/attached';
import type { Line } from '@domain/aggregates/line.aggregate';
import type { OpenRemark, Task } from '@domain/aggregates/task.aggregate';
import { SKILL_FILE } from '@domain/aggregates/team-configuration.aggregate';
import type { Skill } from '@domain/entities/skill.entity';
import { DONE, REVIEW } from '@domain/value-objects/handover-word';
import { RemarkHandle } from '@domain/value-objects/remark-handle.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';

const closing = (line: Line, stationId: StationId): string => {
  const offered = line.optionsFrom(stationId);
  const named = offered
    .flatMap((each) =>
      each.station
        ? [`"${each.station.key.value}" (${each.station.name.value})`]
        : [],
    )
    .join(', ');

  return [
    '## When you are done',
    'Run this, from anywhere in the workspace:',
    '```\nspotlight handover --next "…" --note "…"\n```',
    `\`--next\` names a station to pass the task to, by its key: ${named}. Name somewhere else and the command refuses it and tells you what would have worked, so read what it says and run it again.`,
    `To put the task in front of a person instead of a station, use \`--next "${REVIEW}"\`. That is not a station — it is a person, whatever any station is called — and it is what to use whenever you are unsure.`,
    offered.some((each) => each.kind === 'done')
      ? `Where the work is finished and nothing follows it, use \`--next "${DONE}"\`. That closes the task where it stands: nobody is asked anything, and no station takes it up again. Use it only when there is genuinely nothing left, not to get out of naming somewhere.`
      : null,
    '`--note` is what the next station, or the person, needs to know.',
    'Running nothing puts the task in front of a person.',
    'Nobody is watching this terminal. If you need a decision, a missing detail, or an answer before you can finish, do not ask here and wait: hand the task over with `--next "' +
      REVIEW +
      '"` and put the question in the note. Asking at the terminal reaches nobody, and the task stands still until someone notices.',
  ]
    .filter(Boolean)
    .join('\n\n');
};

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

const listing = (
  skills: readonly Skill[],
  listedIn: string | null,
): string | null =>
  listedIn && skills.length > 0
    ? [
        '## Skills',
        'These are in the workspace. Read one when you reach for what it is about:',
        skills
          .map(
            (each) =>
              `- \`${listedIn}/${each.key.value}/${SKILL_FILE}\` — ${each.description}`,
          )
          .join('\n'),
      ].join('\n\n')
    : null;

const workspaceOf = (line: Line): string | null => {
  const repositories = line.repositories.all;

  if (repositories.length === 0) {
    return null;
  }

  const listed = repositories
    .map((each) => `- \`${each.name}/\` — ${each.value}`)
    .join('\n');

  return repositories.length === 1
    ? [
        '## The workspace',
        `The repository is checked out in:\n\n${listed}`,
      ].join('\n\n')
    : [
        '## The workspace',
        'These repositories are checked out side by side, each in its own directory:',
        listed,
        'Work out which one (or ones) your change belongs in. When you open a pull request, name the repository with `spotlight pull-request --repository <name>`.',
      ].join('\n\n');
};

export const TaskBriefing = {
  brief(input: {
    task: Task;
    line: Line;
    skills: readonly Skill[];
    listedIn: string | null;
  }): string {
    const station = input.line.stationAt(input.task.stationId);
    const notes = input.task.notes.map(
      (note) =>
        `### ${note.station.value}\n\n${Attached.beside(note.body.value, note.attachments)}`,
    );

    return [
      station?.agentPrompt?.value,
      `## ${input.task.title.value}`,
      input.task.description?.value,
      Attached.listed(input.task.attachments),
      notes.length > 0 ? ['## Already done', ...notes].join('\n\n') : null,
      workspaceOf(input.line),
      listing(input.skills, input.listedIn),
      answering(input.task),
      closing(input.line, input.task.stationId),
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
