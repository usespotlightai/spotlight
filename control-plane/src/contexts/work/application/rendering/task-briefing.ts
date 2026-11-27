import { SKILL_FILE } from '@runs/application/contracts/run-spec.contract';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import {
  HANDOVER_TO_A_PERSON,
  HANDOVER_TO_FINISH,
} from '@shared-kernel/domain/value-objects/handover-word';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { SkillBrief } from '@work/application/dto/ready-skill.dto';
import type {
  BriefedMemory,
  MemoryFolder,
} from '@work/application/ports/team-memories.port';
import { Attached } from '@work/application/rendering/attached';
import { ConfiguringSpotlight } from '@work/application/rendering/configuring-spotlight';
import { Learned } from '@work/application/rendering/learned';
import { SpotlightCli } from '@work/application/rendering/spotlight-cli';
import { enabledIntegrations } from '@work/domain/services/enabled-integrations';
import {
  DECIDE_COMMAND,
  HANDOVER_COMMAND,
} from '@work/domain/services/run-reasoning';
import { skillFolderOf } from '@work/domain/services/skill-folder';
import { repositoriesReviewedOrAll } from '@work/domain/services/task-checkouts';
import type { AppGrants } from '@work/domain/value-objects/app-grants.vo';
import type {
  BoundSecret,
  BoundSecretBinding,
} from '@work/domain/value-objects/bound-secret';
import type {
  BriefedTask,
  DecisionOnRecord,
} from '@work/domain/value-objects/briefed-task.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { MAX_HANDOVER_ATTACHMENTS } from '@work/domain/value-objects/handover.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { SandboxVariable } from '@work/domain/value-objects/ready-profile';
import { ReviewCommentHandle } from '@work/domain/value-objects/review-comment-handle.vo';
import { drivenByAPerson } from '@work/domain/value-objects/task-note-body.vo';

const closing = (line: LineMap, stationId: StationId): string => {
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
    `To put the task in front of a person instead of a station, use \`--next "${HANDOVER_TO_A_PERSON}"\`. That is not a station — it is a person, whatever any station is called — and it is what to use whenever you are unsure.`,
    `Where you find that nothing needs to change, but closing the task is a person's decision, add \`--suggest "${HANDOVER_TO_FINISH}"\` to \`--next "${HANDOVER_TO_A_PERSON}"\`. The person gets a button to close the task. Say in the note what you checked.`,
    offered.some((each) => each.kind === 'done')
      ? `Where the work is finished and nothing follows it, use \`--next "${HANDOVER_TO_FINISH}"\`. That closes the task at its current station: nobody is asked anything, and no station takes it up again. Use it only when there is genuinely nothing left, not to get out of naming somewhere.`
      : null,
    `\`--note\` is what the next station, or the person, needs to know. Write it in Markdown. Pipe a long note in, as \`${HANDOVER_COMMAND} --next "…" < note.md\`.`,
    `To show something the note cannot say in words, such as a screenshot, add \`--attach <file>\` for each file, up to ${MAX_HANDOVER_ATTACHMENTS}. The files go on the note.`,
    'Running nothing puts the task in front of a person.',
    'Nobody is watching this terminal. If you need a decision, a missing detail, or an answer before you can finish, do not ask here and wait: hand the task over with `--next "' +
      HANDOVER_TO_A_PERSON +
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

  const one = ReviewCommentHandle.for(open[0].at);

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
  nonEmpty(listedIn) && skills.length > 0
    ? [
        '## Skills',
        'These are in the workspace. Read one when you need what it is about:',
        skills
          .map(
            (each) =>
              `- \`${listedIn}/${skillFolderOf(SkillKey.of(each.key))}/${SKILL_FILE}\` — ${each.description}`,
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

const sending = (secret: SecretName, binding: BoundSecretBinding): string =>
  binding.location === 'query'
    ? `- \`${secret.value}\` to ${binding.host}: send \`${binding.sent}\` as the \`${binding.name}\` query parameter`
    : `- \`${secret.value}\` to ${binding.host}: send \`${binding.sent}\` in the \`${binding.name}\` header`;

const secretsOf = (secrets: readonly BoundSecret[]): string | null =>
  secrets.length > 0
    ? [
        '## Secrets',
        'Egress puts these workspace secrets into the requests you send. Send the stand-in as shown, and egress replaces it with the value. You never see the values. A request without the stand-in goes out without the secret.',
        secrets
          .flatMap((each) =>
            each.bindings.length > 0
              ? each.bindings.map((binding) => sending(each.name, binding))
              : [
                  `- \`${each.name.value}\`: bound to no host, so no request gets it`,
                ],
          )
          .join('\n'),
      ].join('\n\n')
    : null;

const environmentOf = (variables: readonly SandboxVariable[]): string | null =>
  variables.length > 0
    ? [
        '## Secrets in your environment',
        'These environment variables hold the real values of workspace secrets. Use them where the value must be in the sandbox, such as a key that signs a token. Do not print them, write them to a file that you commit, or send them to a host that does not need them. Spotlight replaces the values with stand-ins in your messages, tool output and tool calls, but not in files, attachments, commits or the workspace archive.',
        variables
          .map(
            ({ variable, secret }) =>
              `- \`${variable}\`: secret \`${secret.value}\``,
          )
          .join('\n'),
      ].join('\n\n')
    : null;

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

const RECORDING_DECISIONS = [
  '## Record what you decide',
  `Reviewers of this work are shown the decisions you record. Before you hand over, record each decision that shaped the change with \`${DECIDE_COMMAND}\`, one decision each time:`,
  [
    '- `trade-off`: a trade-off you accept, and what it costs;',
    '- `assumption`: an assumption you rely on but have not checked;',
    '- `limitation`: a limitation or gap you leave in place;',
    '- `rejected-approach`: an approach you weighed and set aside, and why;',
    '- `deviation`: anywhere you depart from what the task, the spec or an earlier note requested.',
  ].join('\n'),
  `Run \`${DECIDE_COMMAND} --kind <kind> --title "…" --why "…" --path <path>\`, with \`--path\` for each changed file the decision bears on and \`--alternative "…"\` for each other way you weighed. Routine choices anyone would make need no record.`,
].join('\n\n');

const PERSISTENT_WORKING_COPY =
  'The task keeps this workspace from one run and station to the next, so work an earlier one left, committed or not, may already be here.';

const workingCopyOf = (task: BriefedTask, line: LineMap): string | null => {
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
        PERSISTENT_WORKING_COPY,
      ].join('\n\n')
    : [
        '## The workspace',
        'These repositories are checked out side by side, each in its own directory:',
        listed,
        'Work out which one (or ones) your change belongs in. When you open a pull request, name the repository with `spotlight tools call pull-request --repository <name>`.',
        PERSISTENT_WORKING_COPY,
      ].join('\n\n');
};

const workflowsOf = (grants: AppGrants): string | null =>
  grants.lacks('workflows')
    ? [
        '## Workflow files',
        'The GitHub App may not change workflows, so GitHub refuses a push with a commit that adds, changes or deletes a file under `.github/workflows/`. Do not commit such a change. If the task needs one, say so plainly in your note, with the change for a person to make. They can let the App change workflows by accepting its updated permissions on GitHub.',
      ].join('\n\n')
    : null;

export const TaskBriefing = {
  brief(input: {
    task: BriefedTask;
    line: LineMap;
    skills: readonly SkillBrief[];
    listedIn: string | null;
    memories: readonly BriefedMemory[];
    memoryFolder: MemoryFolder | null;
    tools: readonly DeclaredTool[];
    boundSecrets: readonly BoundSecret[];
    sandboxEnv: readonly SandboxVariable[];
    drivenByAPerson?: boolean;
    grants: AppGrants;
  }): string {
    const driven = input.drivenByAPerson ?? false;
    const station = input.line.stationAt(input.task.stationId);
    const notes = input.task.notes.map((note) =>
      [
        note.station === null ? null : `### ${note.station}`,
        Attached.beside(note.body, note.attachments),
      ]
        .filter((part) => part !== null)
        .join('\n\n'),
    );

    return [
      driven && station
        ? drivenByAPerson(
            station.name,
            input.line.resumeOptionsAt(input.task.stationId),
          )
        : station?.agentPrompt?.trim(),
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

      station?.memories
        ? Learned.rememberingBeforeHandover()
        : Learned.remembering(),

      station?.decisions ? RECORDING_DECISIONS : null,
      workingCopyOf(input.task, input.line),
      workflowsOf(input.grants),
      SpotlightCli.section,
      ConfiguringSpotlight.section,
      toolsOf(input.tools),
      secretsOf(input.boundSecrets),
      environmentOf(input.sandboxEnv),
      listing(input.skills, input.listedIn),
      replying(input.task),
      driven ? null : closing(input.line, input.task.stationId),
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
