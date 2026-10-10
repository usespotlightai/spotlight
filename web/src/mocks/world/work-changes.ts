import type {
  ChangeStackResponseDto,
  DiffFileResponseDto,
  DiffHunkResponseDto,
  StepChangeResponseDto,
} from '@/lib/api';
import {
  PAID_AT_MIGRATION,
  RUN_STORIES,
  TRIGRAM_MIGRATION,
} from '@/mocks/world/work-stories';

const linesOf = (text: string): string[] =>
  text === '' ? [] : text.replace(/\n$/, '').split('\n');

const diffed = (before: readonly string[], after: readonly string[]) => {
  const common: number[][] = Array.from({ length: before.length + 1 }, () =>
    Array.from({ length: after.length + 1 }, () => 0),
  );

  for (let old = before.length - 1; old >= 0; old -= 1) {
    for (let now = after.length - 1; now >= 0; now -= 1) {
      common[old][now] =
        before[old] === after[now]
          ? common[old + 1][now + 1] + 1
          : Math.max(common[old + 1][now], common[old][now + 1]);
    }
  }

  const lines: string[] = [];
  let old = 0;
  let now = 0;

  while (old < before.length || now < after.length) {
    if (
      old < before.length &&
      now < after.length &&
      before[old] === after[now]
    ) {
      lines.push(` ${before[old]}`);
      old += 1;
      now += 1;
    } else if (
      now < after.length &&
      (old === before.length || common[old][now + 1] >= common[old + 1][now])
    ) {
      lines.push(`+${after[now]}`);
      now += 1;
    } else {
      lines.push(`-${before[old]}`);
      old += 1;
    }
  }

  return lines;
};

const counted = (lines: readonly string[], dropped: '+' | '-'): number =>
  lines.filter((line) => !line.startsWith(dropped)).length;

const hunk = (
  id: string,
  oldStart: number,
  newStart: number,
  context: string,
  lines: readonly string[],
): DiffHunkResponseDto => {
  const oldLines = counted(lines, '+');
  const newLines = counted(lines, '-');

  return {
    id,
    oldStart,
    oldLines,
    newStart,
    newLines,
    patch: [
      `@@ -${oldStart},${oldLines} +${newStart},${newLines} @@${context ? ` ${context}` : ''}`,
      ...lines,
    ].join('\n'),
  };
};

export const hunkOfChange = (
  id: string,
  change: StepChangeResponseDto,
  start = 1,
  context = '',
): DiffHunkResponseDto => {
  const before = linesOf(change.before);
  const lines = diffed(before, linesOf(change.after));

  return hunk(id, before.length === 0 ? 0 : start, start, context, lines);
};

export const file = (
  path: string,
  status: DiffFileResponseDto['status'],
  hunks: DiffHunkResponseDto[],
): DiffFileResponseDto => ({
  path,
  previousPath: null,
  status,
  binary: false,
  hunks,
});

const changeIn = (runId: string, path: string): StepChangeResponseDto => {
  const found = RUN_STORIES[runId]?.steps.find(
    (step) => step.change?.path === path,
  )?.change;

  if (!found) {
    throw new Error(`Run ${runId} changes no ${path}`);
  }

  return found;
};

const changedFile = (
  runId: string,
  path: string,
  id: string,
  start = 1,
  context = '',
): DiffFileResponseDto => {
  const change = changeIn(runId, path);

  return file(path, change.before === '' ? 'added' : 'modified', [
    hunkOfChange(id, change, start, context),
  ]);
};

const lockfileBump = (id: string, at: number) =>
  hunk(id, at, at, '', [
    '     "node_modules/pg": {',
    '-      "version": "8.7.3",',
    '+      "version": "8.13.1",',
    '-      "integrity": "sha512-8bbM3k8kD3Wz0F1c7pQ8YlQ2v4bA==",',
    '+      "integrity": "sha512-n4Xq9cLw1o7R5d2p0hZtUuGmk3eQ==",',
  ]);

const POSTGRES = 'run_postgres_2';

const POSTGRES_API: ChangeStackResponseDto = {
  id: 'stack_postgres_api',
  repository: 'acme/api',
  state: 'ready',
  failure: null,
  check: null,
  files: [
    changedFile(POSTGRES, 'package.json', 'api_package', 14),
    changedFile(POSTGRES, 'src/db/pool.ts', 'api_pool'),
    changedFile(POSTGRES, 'src/db/query.ts', 'api_query'),
    changedFile(POSTGRES, 'src/db/timestamps.ts', 'api_timestamps'),
    changedFile(
      POSTGRES,
      'src/invoices/invoice.repository.ts',
      'api_invoices',
      22,
      'export const openInvoices = async',
    ),
    changedFile(POSTGRES, PAID_AT_MIGRATION, 'api_migration'),
    file('package-lock.json', 'modified', [lockfileBump('api_lockfile', 2104)]),
  ],
  cohorts: [
    {
      id: 'c1',
      kind: 'change',
      title: 'Postgres driver 8.13',
      intent:
        'Move the API to pg 8.13.1 without the native binding, and keep invoice timestamps stable now that the driver returns microseconds.',
      layers: [
        {
          id: 'c1.l1',
          title: 'Drop pg-native and bump pg to 8.13.1',
          summary:
            'The dependency itself, from 8.7.3, and a pool that no longer picks the native binding.',
          ranges: [{ hunk: 'api_package' }, { hunk: 'api_pool' }],
          notes: [
            {
              path: 'src/db/pool.ts',
              note: 'Uses the JavaScript client only, and gives up connecting after 5 seconds.',
            },
          ],
        },
        {
          id: 'c1.l2',
          title: 'Keep microseconds on paid_at',
          summary:
            '8.13 returns `timestamptz` with microseconds, so the column keeps them and the API still answers in milliseconds.',
          ranges: [{ hunk: 'api_timestamps' }, { hunk: 'api_migration' }],
          notes: [
            {
              path: PAID_AT_MIGRATION,
              note: 'Rewrites `invoices.paid_at`, about 1.3M rows, in one statement.',
            },
          ],
        },
        {
          id: 'c1.l3',
          title: 'Type query results',
          summary:
            'The new type definitions no longer accept an untyped result, so `query` takes the row type and the open-invoices query names it.',
          ranges: [{ hunk: 'api_query' }, { hunk: 'api_invoices' }],
          notes: [
            {
              path: 'src/db/query.ts',
              note: 'Makes `query` generic over the row it returns.',
            },
          ],
        },
      ],
    },
    {
      id: 'c2',
      kind: 'incidental',
      title: 'Lockfile',
      intent: 'The lockfile follows the new driver version.',
      layers: [
        {
          id: 'c2.l1',
          title: 'Update the lockfile',
          summary: 'pg and its two internal packages, resolved again.',
          ranges: [{ hunk: 'api_lockfile' }],
          notes: [],
        },
      ],
    },
  ],
};

const SEARCH_RUN = 'run_search_2';

const SEARCH: ChangeStackResponseDto = {
  id: 'stack_search',
  repository: 'acme/api',
  state: 'ready',
  failure: null,
  check: null,
  files: [
    changedFile(SEARCH_RUN, TRIGRAM_MIGRATION, 'search_h1'),
    changedFile(
      SEARCH_RUN,
      'src/search/workspace-search.ts',
      'search_h2',
      21,
      'export const searchTasks = async',
    ),
  ],
  cohorts: [
    {
      id: 'c1',
      kind: 'change',
      title: 'Trigram search on task titles',
      intent:
        'Find tasks by title with an index instead of a full scan, best matches first.',
      layers: [
        {
          id: 'c1.l1',
          title: 'Add the trigram index',
          summary:
            'Built concurrently, so the migration never locks the task table.',
          ranges: [{ hunk: 'search_h1' }],
          notes: [],
        },
        {
          id: 'c1.l2',
          title: 'Search by similarity',
          summary:
            'Matches with the trigram operator and orders by similarity.',
          ranges: [{ hunk: 'search_h2' }],
          notes: [],
        },
      ],
    },
  ],
};

const REFERRAL_RUN = 'run_referral_1';

const REFERRAL: ChangeStackResponseDto = {
  id: 'stack_referral',
  repository: 'acme/web',
  state: 'ready',
  failure: null,
  check: null,
  files: [
    changedFile(REFERRAL_RUN, 'src/lib/referral.ts', 'referral_h1'),
    changedFile(
      REFERRAL_RUN,
      'src/emails/invite.tsx',
      'referral_h2',
      31,
      'export function InviteEmail',
    ),
  ],
  cohorts: [
    {
      id: 'c1',
      kind: 'change',
      title: 'Referral link in the invite email',
      intent:
        'Give everyone who receives an invite a way to pass Acme on, behind a flag.',
      layers: [
        {
          id: 'c1.l1',
          title: 'Build referral links',
          summary: 'A link from the inviter’s referral code.',
          ranges: [{ hunk: 'referral_h1' }],
          notes: [],
        },
        {
          id: 'c1.l2',
          title: 'Show the link in the email',
          summary: 'Below the join button, only with `invite-referral` on.',
          ranges: [{ hunk: 'referral_h2' }],
          notes: [],
        },
      ],
    },
  ],
};

export const RUN_CHANGE_STACKS: Record<string, ChangeStackResponseDto[]> = {
  run_postgres_2: [POSTGRES_API],
  run_search_2: [SEARCH],
  run_referral_1: [REFERRAL],
};

const linesStartingWith = (stack: ChangeStackResponseDto, mark: string) =>
  stack.files
    .flatMap((each) => each.hunks)
    .flatMap((each) => each.patch.split('\n').slice(1))
    .filter((line) => line.startsWith(mark)).length;

export const addedIn = (stack: ChangeStackResponseDto) =>
  linesStartingWith(stack, '+');

export const removedIn = (stack: ChangeStackResponseDto) =>
  linesStartingWith(stack, '-');

export type DiffStat = {
  readonly files: number;
  readonly additions: number;
  readonly deletions: number;
};

export const statOf = (
  stacks: readonly ChangeStackResponseDto[],
): DiffStat => ({
  files: stacks.reduce((sum, stack) => sum + stack.files.length, 0),
  additions: stacks.reduce((sum, stack) => sum + addedIn(stack), 0),
  deletions: stacks.reduce((sum, stack) => sum + removedIn(stack), 0),
});

export const statLine = ({ files, additions, deletions }: DiffStat): string =>
  `${files} files changed, ${additions} insertions(+), ${deletions} deletions(-)`;
