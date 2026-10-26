import { SKILL_FILE } from '@work/application/contracts/run-spec.contract';
import type { SkillBrief } from '@work/application/dto/ready-skill.dto';
import type {
  BriefedMemory,
  MemoryFolder,
} from '@work/application/ports/team-memories.port';
import { Attached } from '@work/application/rendering/attached';
import { Learned } from '@work/application/rendering/learned';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { enabledIntegrations } from '@work/domain/services/enabled-integrations';
import { HANDOVER_COMMAND } from '@work/domain/services/run-reasoning';
import { repositoriesReviewedOrAll } from '@work/domain/services/task-checkouts';
import type {
  BriefedReviewComment,
  BriefedTask,
  DecisionOnRecord,
} from '@work/domain/value-objects/briefed-task.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { DONE, REVIEW } from '@work/domain/value-objects/handover-word';
import { ReviewCommentHandle } from '@work/domain/value-objects/review-comment-handle.vo';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

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
    `\`\`\`\n${HANDOVER_COMMAND} --next "…" --note "…"\n\`\`\``,
    `\`--next\` names a station to pass the task to, by its key: ${named}. Name somewhere else and the command rejects it and tells you what would have worked, so read what it says and run it again.`,
    `To put the task in front of a person instead of a station, use \`--next "${REVIEW}"\`. That is not a station — it is a person, whatever any station is called — and it is what to use whenever you are unsure.`,
    offered.some((each) => each.kind === 'done')
      ? `Where the work is finished and nothing follows it, use \`--next "${DONE}"\`. That closes the task at its current station: nobody is asked anything, and no station takes it up again. Use it only when there is genuinely nothing left, not to get out of naming somewhere.`
      : null,
    '`--note` is what the next station, or the person, needs to know.',
    'Running nothing puts the task in front of a person.',
    'Nobody is watching this terminal. If you need a decision, a missing detail, or an answer before you can finish, do not ask here and wait: hand the task over with `--next "' +
      REVIEW +
      '"` and put the question in the note. Nobody sees a question at the terminal, and the task does not move until someone notices.',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const replying = (task: BriefedTask): string | null => {
  const open = task.openReviewComments;

  if (open.length === 0) {
    return null;
  }

  const listed = open.map((each) =>
    [`- \`${ReviewCommentHandle.for(each.at)}\``, each.place, each.body || null]
      .filter(Boolean)
      .join(' — '),
  );

  const one = ReviewCommentHandle.for((open[0] as BriefedReviewComment).at);

  return [
    '## Replying to review comments',
    'These review comments on the pull request have no reply:',
    ...listed,
    'Run this to reply to one, from anywhere in the workspace:',
    `\`\`\`\nspotlight reply --to ${one} --body "…"\n\`\`\``,
    'Add `--resolve` to resolve the thread as well, where you have addressed what it asked. Leave it off where you are disagreeing or asking something back.',
    `A long reply is easier piped in, as \`spotlight reply --to ${one} < answer.md\`.`,
    'Reply only where you have something to say. The review comments that you do not reply to stay open for whoever picks the task up next.',
  ].join('\n\n');
};

const listing = (
  skills: readonly SkillBrief[],
  listedIn: string | null,
): string | null =>
  listedIn && skills.length > 0
    ? [
        '## Skills',
        'These are in the workspace. Read one when you need what it is about:',
        skills
          .map(
            (each) =>
              `- \`${listedIn}/${SkillKey.of(each.key).folder}/${SKILL_FILE}\` — ${each.description}`,
          )
          .join('\n'),
      ].join('\n\n')
    : null;

const NAMED = new Intl.ListFormat('en', { type: 'conjunction' });

const toolsOf = (described: readonly DeclaredTool[]): string | null => {
  const integrations = enabledIntegrations(described);

  return integrations.length > 0
    ? [
        '## Tools',
        `Your station enables tools from ${NAMED.format(integrations.map((each) => `${each.name} (${each.tools})`))}. Find the one you need with \`spotlight tools search "<words>"\`, read what it takes with \`spotlight tools describe <tool>\`, then call it with \`spotlight tools call <tool>\`. Every tool answers in JSON.`,
      ].join('\n\n')
    : null;
};

const labelled = (kind: string): string => {
  const words = kind.replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const recorded = (decision: DecisionOnRecord): string =>
  [
    `- **${labelled(decision.kind)}** · ${decision.title} — ${decision.why} (${decision.paths.map((path) => `\`${path}\``).join(', ')})`,
    ...decision.disputes.map(
      (reason) => `  - A reviewer disputes it: ${reason}`,
    ),
  ].join('\n');

const onRecord = (decisions: readonly DecisionOnRecord[]): string | null =>
  decisions.length > 0
    ? [
        '## Decisions on record',
        'An earlier run on this task recorded these decisions, and the pull request shows them to its reviewers. Check that the ones your work touches still apply, and weigh what a reviewer disputes. Where you change what one rests on, or find it no longer applies, say so in your note.',
        decisions.map(recorded).join('\n'),
      ].join('\n\n')
    : null;

const SAYING_DECISIONS = [
  '## Say what you decide',
  'Reviewers of this work are shown the decisions you made, taken only from what you say while you work. When you make one, say it in a sentence as you go:',
  [
    '- a trade-off you accept, and what it costs;',
    '- an assumption you rely on but have not checked;',
    '- a limitation or gap you leave in place;',
    '- an approach you weighed and set aside, and why;',
    '- anywhere you depart from what the task, the spec or an earlier note requested.',
  ].join('\n'),
  'Routine choices anyone would make need no mention. Name them again in your handover note.',
].join('\n\n');

const PERSISTENT_WORKSPACE =
  'The task keeps this workspace from one run and station to the next, so work an earlier one left, committed or not, may already be here.';

const workspaceOf = (task: BriefedTask, line: Line): string | null => {
  const repositories = repositoriesReviewedOrAll(task.reviewing, line);

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
        PERSISTENT_WORKSPACE,
      ].join('\n\n')
    : [
        '## The workspace',
        'These repositories are checked out side by side, each in its own directory:',
        listed,
        'Work out which one (or ones) your change belongs in. When you open a pull request, name the repository with `spotlight tools call pull-request --repository <name>`.',
        PERSISTENT_WORKSPACE,
      ].join('\n\n');
};

export const TaskBriefing = {
  brief(input: {
    task: BriefedTask;
    line: Line;
    skills: readonly SkillBrief[];
    listedIn: string | null;
    memories: readonly BriefedMemory[];
    memoryFolder: MemoryFolder | null;
    tools: readonly DeclaredTool[];
  }): string {
    const station = input.line.stationAt(input.task.stationId);
    const notes = input.task.notes.map(
      (note) =>
        `### ${note.station}\n\n${Attached.beside(note.body, note.attachments)}`,
    );

    return [
      station?.agentPrompt?.value.trim(),
      `## ${input.task.title}`,
      input.task.description,
      Attached.listed(input.task.attachments),
      notes.length > 0 ? ['## Already done', ...notes].join('\n\n') : null,
      onRecord(input.task.decisions),
      Learned.section(input.memories),
      Learned.rest({
        folder: input.memoryFolder,
        briefed: input.memories.length > 0,
      }),
      Learned.remembering(),
      station?.decisions ? SAYING_DECISIONS : null,
      workspaceOf(input.task, input.line),
      toolsOf(input.tools),
      listing(input.skills, input.listedIn),
      replying(input.task),
      closing(input.line, input.task.stationId),
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
