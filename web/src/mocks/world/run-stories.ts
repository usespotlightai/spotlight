import type {
  ChangeStackResponseDto,
  JournalStepResponseDto,
  NoteResponseDto,
  RunJournalResponseDto,
  TaskRunResponseDto,
} from '@/lib/api';
import { world } from '@/mocks/world';
import type { HistoryRun } from '@/mocks/world/insights-history';
import { MINUTE_MS } from '@/mocks/world/insights-measures';
import { pullRequestUrlOf } from '@/mocks/world/insights-pull-requests';
import {
  historyRunOf,
  historyRunsOfTask,
  historyTaskOf,
  pastRunsOfTask,
  stationOfId,
} from '@/mocks/world/past-work';
import { PEOPLE, SAM } from '@/mocks/world/people';
import { knownTaskNote } from '@/mocks/world/station-tasks';
import {
  file,
  hunkOfChange,
  RUN_CHANGE_STACKS,
  statLine,
  statOf,
} from '@/mocks/world/work-changes';
import {
  answered,
  asked,
  edit,
  execute,
  failedWith,
  messageStep,
  type NoteScript,
  passed,
  RUN_STORIES,
  type RunStory,
  read,
  type StepScript,
  spend,
  thought,
} from '@/mocks/world/work-stories';

const SECOND = 1_000;
export const PREPARE_MS = 20 * SECOND;
export const PUBLISH_MS = 10 * SECOND;
const CONTEXT_SIZE = 200_000;

export const finished = (run: TaskRunResponseDto) =>
  run.state === 'completed' ||
  run.state === 'failed' ||
  run.state === 'cancelled' ||
  run.state === 'superseded';

export const endOf = (run: TaskRunResponseDto): number =>
  finished(run) ? Date.parse(run.updatedAt) : Date.now();

const DIFFED_BY: Record<string, string> = {
  run_postgres_3: 'run_postgres_2',
  run_search_3: 'run_search_2',
};

const withDiffStat = (runId: string, story: RunStory): RunStory => {
  const opener = DIFFED_BY[runId];
  if (!opener) {
    return story;
  }
  const stat = statLine(statOf(RUN_CHANGE_STACKS[opener] ?? []));

  return {
    ...story,
    steps: story.steps.map((step) =>
      step.text.startsWith('gh pr diff') ? { ...step, detail: stat } : step,
    ),
  };
};

const GROWTH_PATHS: readonly (readonly [string, string])[] = [
  ['sign-up', 'src/signup/SignupForm.tsx'],
  ['plans page', 'src/pricing/PlansPage.tsx'],
  ['pricing', 'src/pricing/PlansPage.tsx'],
  ['annual', 'src/pricing/PlansPage.tsx'],
  ['sidebar', 'src/layout/Sidebar.tsx'],
  ['trial', 'src/emails/TrialNudge.tsx'],
  ['dashboard', 'src/dashboard/EmptyDashboard.tsx'],
  ['cancel', 'src/account/CancelFlow.tsx'],
  ['template', 'src/projects/templates.ts'],
  ['experiment', 'src/flags/experiments.ts'],
];

const API_PATHS: readonly (readonly [string, string])[] = [
  ['webhook', 'src/webhooks/deliver.ts'],
  ['refund', 'src/billing/refunds.ts'],
  ['pdf', 'src/invoices/pdf.ts'],
  ['invoice', 'src/invoices/invoice.service.ts'],
  ['payment', 'src/payments/payments.service.ts'],
  ['card', 'src/payments/charge.ts'],
  ['stripe', 'src/payments/stripe.ts'],
  ['session', 'src/auth/sessions.ts'],
  ['sso', 'src/auth/sso.ts'],
  ['login', 'src/auth/sessions.ts'],
  ['password', 'src/auth/sessions.ts'],
  ['export', 'src/exports/csv-export.ts'],
  ['csv', 'src/exports/csv-export.ts'],
  ['429', 'src/http/rate-limit.ts'],
  ['rate', 'src/http/rate-limit.ts'],
  ['search', 'src/search/workspace-search.ts'],
  ['notification', 'src/notifications/dispatch.ts'],
  ['email', 'src/notifications/email.ts'],
  ['receipt', 'src/notifications/email.ts'],
  ['usage', 'src/reports/usage.ts'],
  ['upload', 'src/storage/uploads.ts'],
  ['cron', 'src/worker/schedules.ts'],
  ['worker', 'src/worker/runner.ts'],
  ['job', 'src/worker/jobs.ts'],
  ['queue', 'src/worker/queue.ts'],
  ['pricing', 'src/billing/pricing.ts'],
  ['coupon', 'src/billing/coupons.ts'],
  ['dunning', 'src/billing/dunning.ts'],
  ['subscription', 'src/billing/subscriptions.ts'],
  ['balance', 'src/billing/balance.ts'],
  ['credit', 'src/billing/credit-notes.ts'],
  ['plan', 'src/billing/plans.ts'],
  ['tracing', 'src/observability/tracing.ts'],
  ['log', 'src/observability/logger.ts'],
  ['node', 'Dockerfile'],
  ['table', 'migrations/0031_drop_legacy_plans.sql'],
  ['index', 'migrations/0034_invoices_customer_status.sql'],
  ['audit', 'src/audit/export.ts'],
  ['idempotency', 'src/payments/idempotency.ts'],
  ['flag', 'src/flags/eu-invoicing.ts'],
  ['backfill', 'scripts/backfill.ts'],
  ['health', 'src/health/queue.ts'],
  ['report', 'src/reports/usage.ts'],
  ['replica', 'infra/postgres/replica.tf'],
  ['disk', 'infra/search/nodes.tf'],
  ['memory', 'infra/worker/pods.tf'],
  ['gateway', 'infra/gateway/routes.tf'],
  ['latency', 'src/payments/provider.ts'],
];

const slugOf = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

const pathOf = (taskId: string, title: string, lineId: string): string => {
  const known = knownTaskNote(taskId);
  if (known) {
    return known.path;
  }
  const lower = title.toLowerCase();
  const paths = lineId === 'line_experiments' ? GROWTH_PATHS : API_PATHS;
  const found = paths.find(([word]) => lower.includes(word));

  return found?.[1] ?? 'src/app.ts';
};

const nounOf = (path: string): string =>
  (path.split('/').at(-1) ?? 'change').split(/[.\-_]/)[0] ?? 'change';

const testPathOf = (path: string): string => `test/${nounOf(path)}.test.ts`;

type Context = {
  readonly run: HistoryRun;
  readonly title: string;
  readonly path: string;
  readonly person: (typeof PEOPLE)[number];
  readonly next: string | null;
  readonly finishing: boolean;
  readonly pullRequest: string | null;
  readonly answerAfter: number;
  readonly before: string | undefined;
};

const pullLabel = (url: string): string => {
  const [, , , owner, repository, , number] = url.split('/');
  return `${owner}/${repository}#${number}`;
};

const opened = (context: Context): string =>
  context.pullRequest
    ? `[${pullLabel(context.pullRequest)}](${context.pullRequest})`
    : 'the pull request';

const answerOf = (context: Context, yes: string, no: string): NoteScript[] =>
  context.run.next
    ? [
        answered(
          context.person,
          context.run.next.act === 'sent-back' ? no : yes,
          context.answerAfter,
        ),
      ]
    : [];

const closingNotes = (
  context: Context,
  ask: string,
  pass: string,
  yes: string,
  no: string,
): NoteScript[] => {
  const { run } = context;
  if (run.ending === 'failed') {
    return [
      failedWith(
        `The run exited before it finished: ${(run.failure ?? 'the agent stopped').replace(/^\w/, (letter) => letter.toLowerCase())}.`,
      ),
    ];
  }
  if (run.ending === 'stopped') {
    return [];
  }
  if (run.next) {
    return [asked(ask), ...answerOf(context, yes, no)];
  }
  return [passed(pass)];
};

const failingStep = (context: Context): StepScript[] =>
  context.run.ending === 'failed'
    ? [
        execute(
          'npm test',
          context.run.failure ?? 'The agent stopped answering',
          2,
          'failed',
        ),
      ]
    : [];

const triageStory = (context: Context): Omit<RunStory, 'spend'> => {
  const noun = nounOf(context.path);
  return {
    steps: [
      thought(`Reproduce “${context.title}” first, then say what a fix needs.`),
      read(context.path),
      execute(
        `rg -n "${noun}" src --count`,
        `${context.path}:${Math.round(3 + ((context.run.ms ?? 0) % 9))}`,
        1,
      ),
      ...failingStep(context),
      ...(context.run.ending === 'completed'
        ? [
            messageStep(
              `Reproduced it. The failing path is \`${context.path}\`; a fix needs a test that covers it.`,
            ),
          ]
        : []),
    ],
    notes: closingNotes(
      context,
      `Reproduced it in \`${context.path}\`. Should it go to ${context.next ?? 'the next station'}?`,
      `Passed to ${context.next ?? 'the next station'}. Reproduced it: the failing path is \`${context.path}\`, and a fix needs a test that covers it.`,
      'Yes, pass it on.',
      'This is expected behaviour; close it.',
    ),
    output: `Reproduced in ${context.path}.`,
  };
};

const specStory = (context: Context): Omit<RunStory, 'spend'> => {
  const spec = `docs/specs/${slugOf(context.title)}.md`;
  return {
    before: context.before,
    steps: [
      read(context.path),
      thought(
        'List what changes and what stays, so Implementation does not have to guess.',
      ),
      edit(
        spec,
        '',
        `# ${context.title}\n\n- Change \`${context.path}\`\n- Cover it in \`${testPathOf(context.path)}\`\n- Leave the public API as it is\n`,
        3,
      ),
      ...failingStep(context),
      ...(context.run.ending === 'completed'
        ? [messageStep('The spec is ready for review.')]
        : []),
    ],
    notes: closingNotes(
      context,
      `The spec is in \`${spec}\`: change \`${context.path}\` and cover it in \`${testPathOf(context.path)}\`. Hand it to ${context.next ?? 'Implementation'}?`,
      `Passed to ${context.next ?? 'Implementation'}. The spec is in \`${spec}\`.`,
      'Yes, hand it over.',
      'Not yet: the spec should say what happens to the data that is already there.',
    ),
    output: `Spec in ${spec}.`,
  };
};

const EDITS: Record<string, (noun: string) => readonly [string, string]> = {
  fix: (noun) => [
    `  const ${noun} = await find(id);\n  return ${noun}.total;`,
    `  const ${noun} = await find(id);\n  if (!${noun}) {\n    throw new NotFoundError('${noun}', id);\n  }\n  return ${noun}.total;`,
  ],
  feature: (noun) => [
    `export const routes = [\n  get('/${noun}', list),\n];`,
    `export const routes = [\n  get('/${noun}', list),\n  post('/${noun}', create),\n];`,
  ],
  refactor: (noun) => [
    `import { ${noun} } from './legacy';`,
    `import { ${noun} } from './${noun}';`,
  ],
  tests: (noun) => [
    '',
    `describe('${noun}', () => {\n  it('keeps the totals when it runs twice', async () => {\n    expect(await run()).toEqual(await run());\n  });\n});`,
  ],
  chore: () => ['const RETENTION_DAYS = 30;', 'const RETENTION_DAYS = 14;'],
};

const editsOf = (context: Context): StepScript[] => {
  const type = historyTaskOf(context.run.taskId)?.pullRequest?.type ?? 'fix';
  const noun = nounOf(context.path);
  const [before, after] = (EDITS[type] ?? EDITS.fix)?.(noun) ?? ['', ''];
  const [, test] = EDITS.tests?.(noun) ?? ['', ''];

  return type === 'tests'
    ? [edit(testPathOf(context.path), '', after)]
    : [
        edit(context.path, before, after),
        edit(testPathOf(context.path), '', test),
      ];
};

const openerStatOf = (run: HistoryRun) => {
  const opener = historyRunsOfTask(run.taskId)
    .filter(
      (each) =>
        each.at < run.at &&
        (each.stationId === 'station_implementation' ||
          each.stationId === 'station_build'),
    )
    .map((each) => changeStacksOf(each.runId))
    .findLast((stacks) => stacks.length > 0);

  return opener ? statOf(opener) : null;
};

const buildStory = (context: Context): Omit<RunStory, 'spend'> => {
  const failedChecks = context.run.checks === 'failed';
  const delivers = context.run.ending === 'completed' && !failedChecks;
  const known = knownTaskNote(context.run.taskId);
  const summary = failedChecks
    ? (known?.fail ?? 'One test still fails.')
    : (known?.pass ?? 'Did what the spec says and kept the tests passing.');
  const brief =
    context.run.stationId === 'station_build'
      ? `docs/experiments/${slugOf(context.title)}.md`
      : `docs/specs/${slugOf(context.title)}.md`;
  const asks = context.finishing
    ? 'Merge it?'
    : `Ready for ${context.next ?? 'review'}?`;
  return {
    before: context.before,
    steps: [
      read(brief),
      read(context.path),
      ...editsOf(context),
      ...failingStep(context),
      ...(context.run.ending === 'completed'
        ? [
            execute(
              'npm test',
              failedChecks
                ? '1 failing'
                : `${40 + (context.title.length % 30)} passing`,
              3,
              failedChecks ? 'failed' : 'completed',
            ),
          ]
        : []),
      ...(delivers && context.pullRequest
        ? [
            execute(
              `gh pr create --title "${context.title}"`,
              context.pullRequest,
              1,
            ),
          ]
        : []),
      ...(context.run.ending === 'completed' ? [messageStep(summary)] : []),
    ],
    notes: closingNotes(
      context,
      failedChecks
        ? `${summary} Send it back, or let me try again?`
        : `${summary} Opened ${opened(context)}. ${asks}`,
      `${summary} Opened ${opened(context)} and passed it to ${context.next ?? 'review'}.`,
      'Looks right, pass it on.',
      'Send it back: the tests have to pass before anyone reviews it.',
    ),
    output: summary,
  };
};

const reviewStory = (context: Context): Omit<RunStory, 'spend'> => {
  const record = historyTaskOf(context.run.taskId)?.pullRequest;
  const number = context.pullRequest?.split('/').at(-1) ?? '';
  const stat =
    openerStatOf(context.run) ??
    (record
      ? {
          files: record.changedFiles,
          additions: record.additions,
          deletions: record.deletions,
        }
      : null);
  return {
    before: context.before,
    steps: [
      execute(`gh pr diff ${number} --stat`, stat ? statLine(stat) : '', 1),
      read(context.path),
      thought('Check what would break in production before anything else.'),
      ...failingStep(context),
    ],
    notes: closingNotes(
      context,
      `Reviewed ${opened(context)}. Nothing in \`${context.path}\` would break in production. Approve the merge?`,
      `Reviewed ${opened(context)} and passed it on.`,
      'Approved, merging.',
      'Send it back: it needs a test for the empty case.',
    ),
    output: `Reviewed ${context.pullRequest ? pullLabel(context.pullRequest) : 'the change'}.`,
  };
};

const clockOf = (runId: string): string => {
  const sum = [...runId].reduce(
    (total, letter) => total + letter.charCodeAt(0),
    0,
  );
  return `${String(sum % 24).padStart(2, '0')}:${String((sum * 7) % 60).padStart(2, '0')}`;
};

const revisionOf = (runId: string): number =>
  20 +
  ([...runId].reduce((total, letter) => total + letter.charCodeAt(0), 0) % 60);

const investigateStory = (context: Context): Omit<RunStory, 'spend'> => {
  const deployed = clockOf(context.run.taskId);
  return {
    steps: [
      execute(
        'grafana query --since 2h --panel overview',
        `error rate 0.4% → 3.1% at ${deployed}`,
        2,
      ),
      execute(
        'kubectl logs --since=1h --all-containers | rg -c "error"',
        '1,184',
        2,
      ),
      thought(
        `The errors start with the ${deployed} deploy and stay on one service.`,
      ),
      ...failingStep(context),
    ],
    notes: closingNotes(
      context,
      `“${context.title}” started with the ${deployed} deploy and stays on one service. Should Mitigate roll it back?`,
      `Passed to ${context.next ?? 'Mitigate'}. The errors start with the ${deployed} deploy.`,
      'Yes, roll it back.',
      'Not the deploy: look at the provider status first.',
    ),
    output: `Started with the ${deployed} deploy.`,
  };
};

const mitigateStory = (context: Context): Omit<RunStory, 'spend'> => {
  const revision = revisionOf(context.run.taskId);
  return {
    before: context.before,
    steps: [
      execute(
        'kubectl rollout undo deploy/api',
        `rolled back to revision ${revision}`,
        2,
      ),
      execute(
        'grafana query --since 30m --panel overview',
        'error rate 0.3%',
        2,
      ),
      ...failingStep(context),
    ],
    notes: closingNotes(
      context,
      `Rolled back to revision ${revision}; the error rate is back at 0.3%. Close the incident?`,
      `Rolled back to revision ${revision}; the error rate is back at 0.3%.`,
      'Yes, close it. Thanks.',
      'Keep it open until the fix is out.',
    ),
    output: `Rolled back to revision ${revision}.`,
  };
};

const designStory = (context: Context): Omit<RunStory, 'spend'> => {
  const brief = `docs/experiments/${slugOf(context.title)}.md`;
  return {
    steps: [
      read(context.path),
      thought(
        'Keep the control group unchanged and pick one metric to decide on.',
      ),
      edit(
        brief,
        '',
        `# ${context.title}\n\n- Behind a flag, half of new workspaces\n- Metric: first project within 24 hours\n- Stop after two weeks\n`,
      ),
      ...failingStep(context),
    ],
    notes: closingNotes(
      context,
      `The experiment brief is in \`${brief}\`: half of new workspaces, measured by first projects within 24 hours. Build it?`,
      `Passed to Build. The brief is in \`${brief}\`.`,
      'Yes, build it.',
      'Pick a metric we can read within a week.',
    ),
    output: `Brief in ${brief}.`,
  };
};

const STORIES: Record<string, (context: Context) => Omit<RunStory, 'spend'>> = {
  station_triage: triageStory,
  station_spec: specStory,
  station_implementation: buildStory,
  station_build: buildStory,
  station_review: reviewStory,
  station_investigate: investigateStory,
  station_mitigate: mitigateStory,
  station_design: designStory,
};

const pastStories = new Map<string, RunStory>();

const pastStoryOf = (run: HistoryRun): RunStory => {
  const task = historyTaskOf(run.taskId);
  const earlier = historyRunsOfTask(run.taskId).filter(
    (each) => each.at < run.at,
  );
  const previous = earlier.at(-1);
  const context: Context = {
    run,
    title: task?.title ?? '',
    path: pathOf(run.taskId, task?.title ?? '', run.lineId),
    person: PEOPLE.find((each) => each.id === task?.openedBy) ?? SAM,
    next: run.passed ? (stationOfId(run.passed.to)?.name ?? null) : null,
    finishing: run.passed
      ? stationOfId(run.passed.to)?.kind === 'completed'
      : false,
    pullRequest: task?.pullRequest
      ? pullRequestUrlOf(task.teamId, task.id)
      : null,
    answerAfter: run.next
      ? Math.round(
          (Date.parse(run.next.at) - Date.parse(run.endedAt ?? '')) / MINUTE_MS,
        )
      : 0,
    before: previous ? storyOf(previous.runId).output : undefined,
  };
  const made = (STORIES[run.stationId] ?? triageStory)(context);
  const tokens = run.tokens;

  return {
    ...made,
    spend:
      run.cost && tokens
        ? spend(
            run.cost.amount,
            tokens.input ?? 0,
            tokens.output ?? 0,
            tokens.cacheRead ?? 0,
            tokens.cacheWrite ?? 0,
          )
        : null,
  };
};

const NO_STORY: RunStory = { spend: null, steps: [], notes: [] };

export const storyOf = (runId: string): RunStory => {
  const core = RUN_STORIES[runId];
  if (core) {
    return withDiffStat(runId, core);
  }
  const found = pastStories.get(runId);
  if (found) {
    return found;
  }
  const run = historyRunOf(runId);
  if (!run) {
    return NO_STORY;
  }
  const made = pastStoryOf(run);
  pastStories.set(runId, made);
  return made;
};

const pastStacks = new Map<string, ChangeStackResponseDto[]>();

const pastStacksOf = (runId: string): ChangeStackResponseDto[] => {
  const run = historyRunOf(runId);
  const task = run ? historyTaskOf(run.taskId) : undefined;
  const builds =
    run?.stationId === 'station_implementation' ||
    run?.stationId === 'station_build';
  if (!run || !task?.pullRequest || !builds || run.ending !== 'completed') {
    return [];
  }
  const changes = storyOf(runId).steps.flatMap((step) =>
    step.change ? [step.change] : [],
  );

  return changes.length === 0
    ? []
    : [
        {
          id: `stack_${runId}`,
          repository: task.pullRequest.repository,
          state: 'ready',
          failure: null,
          check: null,
          files: changes.map((change, place) =>
            file(
              change.path ?? '',
              change.before === '' ? 'added' : 'modified',
              [hunkOfChange(`${runId}_h${place + 1}`, change, 12)],
            ),
          ),
          cohorts: [
            {
              id: 'c1',
              kind: 'change',
              title: task.title,
              intent: storyOf(runId).output ?? task.title,
              layers: changes.map((change, place) => ({
                id: `c1.l${place + 1}`,
                title: `Change ${change.path ?? ''}`,
                summary: storyOf(runId).output ?? '',
                ranges: [{ hunk: `${runId}_h${place + 1}` }],
                notes: [],
              })),
            },
          ],
        },
      ];
};

export const changeStacksOf = (runId: string): ChangeStackResponseDto[] => {
  const core = RUN_CHANGE_STACKS[runId];
  if (core) {
    return core;
  }
  const found = pastStacks.get(runId) ?? pastStacksOf(runId);
  pastStacks.set(runId, found);
  return found;
};

export const runsOfAnyTask = (taskId: string): TaskRunResponseDto[] =>
  world().runs[taskId] ?? pastRunsOfTask(taskId);

type Timed = { readonly startedAt: number; readonly ms: number };

const timingsOf = (
  run: TaskRunResponseDto,
  steps: readonly StepScript[],
): Timed[] => {
  const from = Date.parse(run.startedAt) + PREPARE_MS;
  const to = endOf(run) - (finished(run) ? PUBLISH_MS : 0);
  const span = Math.max(to - from, SECOND * steps.length);
  const whole = steps.reduce((sum, each) => sum + each.weight, 0) || 1;
  let at = from;

  return steps.map((step) => {
    const ms = Math.round((span * step.weight) / whole);
    const timed = { startedAt: at, ms };
    at += ms;
    return timed;
  });
};

export const timedSteps = (
  run: TaskRunResponseDto,
  story: RunStory,
): JournalStepResponseDto[] => {
  const timings = timingsOf(run, story.steps);

  return story.steps.map((script, place) => {
    const timed = timings[place] ?? { startedAt: Date.now(), ms: 0 };

    return {
      kind: script.kind ?? 'tool',
      text: script.text,
      status:
        script.kind && script.kind !== 'tool'
          ? null
          : (script.status ?? 'completed'),
      tool: script.tool ?? null,
      detail: script.detail ?? null,
      ms: timed.ms,
      startedAt: new Date(timed.startedAt).toISOString(),
      locations: script.locations ?? [],
      input: null,
      output: null,
      change: script.change ?? null,
    };
  });
};

const usedOf = (story: RunStory): number => {
  const spent = story.spend;
  return spent
    ? (spent.inputTokens ?? 0) +
        (spent.outputTokens ?? 0) +
        (spent.cacheWriteTokens ?? 0)
    : 0;
};

const journalOf = (run: TaskRunResponseDto): RunJournalResponseDto => {
  const story = storyOf(run.id);
  const steps = timedSteps(run, story);
  const ready = new Date(Date.parse(run.startedAt) + PREPARE_MS).toISOString();

  return {
    runId: run.id,
    attempt: run.attempt,
    steps,
    spans: [],
    ms: finished(run)
      ? Date.parse(run.updatedAt) - Date.parse(run.startedAt)
      : null,
    marks: {
      startedAt: run.startedAt,
      readyAt: ready,
      firstAgentUpdateAt: ready,
      lastAgentUpdateAt: steps.at(-1)?.startedAt ?? null,
      endedAt: finished(run) ? run.updatedAt : null,
    },
    spent: {
      used: usedOf(story),
      size: CONTEXT_SIZE,
      cost: story.spend?.cost ?? null,
      currency: story.spend ? 'USD' : null,
    },
  };
};

export const journalsOfTask = (taskId: string): RunJournalResponseDto[] =>
  [...runsOfAnyTask(taskId)]
    .sort((one, other) => one.startedAt.localeCompare(other.startedAt))
    .filter((run) => run.state !== 'queued')
    .map(journalOf);

export type StoryNote = Omit<NoteResponseDto, 'position'>;

export const storyNoteOf = (
  run: TaskRunResponseDto,
  script: NoteScript,
): StoryNote => {
  const station = run.station;
  const fromPerson = script.kind === 'answered' || script.kind === 'message';
  const at =
    script.minutesIn !== undefined
      ? Date.parse(run.startedAt) + script.minutesIn * MINUTE_MS
      : endOf(run) + (script.minutesAfterEnd ?? 0) * MINUTE_MS;

  return {
    kind: script.kind,
    form: script.form ?? 'words',
    voice: fromPerson ? 'person' : 'station',
    station: station?.name ?? '',
    stationColor: station?.color ?? '',
    stationPosition: station?.position ?? 0,
    runId: fromPerson ? null : run.id,
    body: script.body,
    attachments: [],
    at: new Date(at).toISOString(),
    author: script.author ?? null,
    approval: script.approval ? structuredClone(script.approval) : null,
    failure: script.failure ?? null,
    connection: null,
  };
};

export const notesOfRun = (run: TaskRunResponseDto): StoryNote[] =>
  storyOf(run.id).notes.map((script) => storyNoteOf(run, script));
