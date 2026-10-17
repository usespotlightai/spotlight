import { pullRequestTypeOf } from '@outcomes/domain/services/pull-request-types';
import { pullRequestTypeSql } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/pull-request-type.sql';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

const TITLES = [
  'Fix the login',
  'fixes #12',
  'Fixed it',
  'FIX: the queue',
  'fix(api)!: drop v1',
  'feat(ui): add a button',
  'feature: uploads',
  'Feat!: breaking',
  'perf: faster',
  'ci: cache deps',
  'build: cache deps',
  'deps: bump',
  'revert: "Add uploads"',
  'Revert "Add uploads"',
  'toString: odd',
  'constructor: odd',
  'unknown: word',
  '  Add uploads',
  'Addition of uploads',
  'add more unit tests for retries',
  'Write e2e tests',
  'cover tests',
  'Tests for the queue',
  'testing the queue',
  'Update dependencies',
  'update deps',
  'update the readme',
  'Bump lodash',
  'Upgrade node',
  'Release 1.2',
  'docs: explain setup',
  'Doc tweak',
  'Refactor the queue',
  'clean up the queue',
  'Cleanup the queue',
  'tidy imports',
  'move files',
  'fix_this',
  'Implement retries',
  'Let people retry',
  'Show more',
  'Retry failed uploads',
  'Ünicode: fix',
  'Fixé the parser',
  'fixé: x',
  'Fixß',
  'Testé la feature',
  'Supportée',
  'refactoré',
  'Bumpé',
  '\u00a0fix: nbsp',
  '\u202fFix',
  '\ufeffFix bom',
  '\u1680Fix',
  '\u0085Fix nel',
  '\u2007Fix',
  'update\u00a0deps',
  'update\u0085deps',
  'clean\u00a0up',
  'clean\u0085up',
  'add\u00a0tests',
  'İmplement retries',
  'ſhow more',
  '',
];

const BRANCHES = [
  null,
  '',
  'feat/uploads',
  'Feature-uploads',
  'bugfix/login',
  'hotfix-1',
  'bug/x',
  'refactoring/queue',
  'tests/queue',
  'dependabot/npm',
  'renovate-lock',
  'release/1.2',
  'fix',
  'my/fix/branch',
];

const SHAPES: readonly (readonly [readonly string[], readonly string[]])[] = [
  [[], []],
  [['Add uploads'], ['']],
  [
    ['Add uploads', 'Fix the login'],
    ['', ''],
  ],
  [
    ['Fix the login', 'Add uploads'],
    ['', ''],
  ],
  [
    ['Rework things', 'More things'],
    ['Add uploads', 'fix the queue'],
  ],
  [['Rework things'], []],
  [
    ['Tidy', 'Tidy imports', 'Fix it'],
    ['', '', ''],
  ],
  [
    ['Write tests', 'Fix it', 'Fix more', 'Add one'],
    ['', '', '', ''],
  ],
  [
    ['chore: deps', 'feat: x', 'fix: y'],
    ['', '', ''],
  ],
  [['Nothing here'], ['Nothing either']],
  [['Nothing'], ['', 'Fix it']],
  [['Fix it'], ['Add x']],
  [
    ['Rework things', 'More things', 'Fix it'],
    ['', '', ''],
  ],
];

interface Case {
  readonly ord: number;
  readonly title: string;
  readonly branch: string | null;
  readonly titles: readonly string[] | null;
  readonly intents: readonly string[] | null;
}

const CASES: readonly Case[] = [
  ...TITLES.flatMap((title) =>
    BRANCHES.map((branch) => ({ title, branch, titles: null, intents: null })),
  ),
  ...TITLES.flatMap((title) =>
    SHAPES.map(([titles, intents]) => ({
      title,
      branch: 'feat/x',
      titles,
      intents,
    })),
  ),
].map((each, ord) => ({ ...each, ord }));

let database: TestDatabase;

beforeAll(async () => {
  database = await openDatabase('pull_request_type');
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('the pull request type, read in SQL', () => {
  it('is the type the domain gives for every title, branch and change shape', async () => {
    const result = await database.db.execute<{ ord: number; type: string }>(sql`
      select change.ord, ${pullRequestTypeSql({
        title: sql`change.title`,
        branch: sql`change.branch`,
        changeTitles: sql`change.titles`,
        changeIntents: sql`change.intents`,
      })} as type
      from jsonb_to_recordset(${JSON.stringify(CASES)}::jsonb)
        as change(ord int, title text, branch text, titles text[], intents text[])
      order by change.ord
    `);

    expect(result.rows.map((row) => row.type)).toEqual(
      CASES.map((each) =>
        pullRequestTypeOf({
          title: each.title,
          branch: each.branch,
          changeTitles: each.titles ?? [],
          changeIntents: each.intents ?? [],
        }),
      ),
    );
    expect(new Set(result.rows.map((row) => row.type)).size).toBe(6);
  });
});
