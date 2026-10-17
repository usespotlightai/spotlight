import {
  BRANCH_PREFIXES,
  CONVENTIONAL,
  CONVENTIONAL_TYPES,
  LEADING_WORDS,
  UNMATCHED,
} from '@outcomes/domain/services/pull-request-types';
import {
  PULL_REQUEST_TYPES,
  type PullRequestType,
} from '@outcomes/domain/value-objects/pull-request-type';
import { textArray } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import { type SQL, sql } from 'drizzle-orm';

const JS_SPACE =
  '[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]';

const OUTSIDE_BRACKETS: ReadonlyMap<string, string> = new Map([
  ['s', JS_SPACE],
  ['b', '\\y'],
  ['(', '\\('],
  [')', '\\)'],
  ['/', '/'],
]);

const INSIDE_BRACKETS: ReadonlyMap<string, string> = new Map([['/', '/']]);

const unreadable = (rule: RegExp, why: string): Error =>
  new Error(`A pull request type rule ${why} SQL cannot read: ${rule}`);

const EMPTY_CLASS = /^\[\^?\]/;

const patternOf = (rule: RegExp): string => {
  if (rule.flags.replace('i', '') !== '') {
    throw unreadable(rule, 'has flags');
  }
  if ([...rule.source].some((each) => each.charCodeAt(0) > 0x7f)) {
    throw unreadable(rule, 'has a character outside ASCII');
  }

  let pattern = rule.flags.includes('i') ? '(?i)' : '';
  let inBrackets = false;
  for (let at = 0; at < rule.source.length; at++) {
    const each = rule.source[at];
    if (each === '\\') {
      at++;
      const escaped = (inBrackets ? INSIDE_BRACKETS : OUTSIDE_BRACKETS).get(
        rule.source[at] ?? '',
      );
      if (escaped === undefined) {
        throw unreadable(rule, 'has an escape');
      }
      pattern += escaped;
    } else if (inBrackets) {
      if (each === '[') {
        throw unreadable(rule, 'has a bracket in a class');
      }
      inBrackets = each !== ']';
      pattern += each;
    } else {
      if (each === '.') {
        throw unreadable(rule, 'has a dot');
      }
      if (each === '[') {
        if (EMPTY_CLASS.test(rule.source.slice(at))) {
          throw unreadable(rule, 'has an empty class');
        }
        inBrackets = true;
      }
      pattern += each;
    }
  }

  return pattern;
};

const inC = (text: SQL): SQL => sql`(${text} collate "C")`;

const firstMatch = (
  text: SQL,
  rules: readonly (readonly [RegExp, PullRequestType])[],
): SQL =>
  sql`(case ${sql.join(
    rules.map(
      ([rule, type]) =>
        sql`when ${inC(text)} ~ ${patternOf(rule)} then ${type}`,
    ),
    sql` `,
  )} end)`;

const conventionalOf = (text: SQL): SQL =>
  sql`(case lower(substring(${inC(text)} from ${patternOf(CONVENTIONAL)})) ${sql.join(
    [...CONVENTIONAL_TYPES.entries()].map(
      ([word, type]) => sql`when ${word} then ${type}`,
    ),
    sql` `,
  )} end)`;

const typeOfTitle = (text: SQL): SQL =>
  sql`coalesce(${conventionalOf(text)}, ${firstMatch(text, LEADING_WORDS)})`;

const typeOfBranch = (branch: SQL): SQL =>
  sql`(case when coalesce(${branch}, '') <> '' then ${firstMatch(branch, BRANCH_PREFIXES)} end)`;

const typeOfChanges = (titles: SQL, intents: SQL): SQL => sql`(
  select typed.type
  from (
    select coalesce(
      ${typeOfTitle(sql`change.title`)},
      ${typeOfTitle(sql`coalesce(change.intent, '')`)}
    ) as type
    from unnest(${titles}, ${intents}) as change(title, intent)
    where change.title is not null
  ) as typed
  where typed.type is not null
  group by typed.type
  order by count(*) desc, array_position(${textArray(PULL_REQUEST_TYPES)}, typed.type)
  limit 1
)`;

export const pullRequestTypeSql = (columns: {
  readonly title: SQL;
  readonly branch: SQL;
  readonly changeTitles: SQL;
  readonly changeIntents: SQL;
}): SQL =>
  sql`coalesce(
    ${typeOfChanges(sql`coalesce(${columns.changeTitles}, '{}'::text[])`, sql`coalesce(${columns.changeIntents}, '{}'::text[])`)},
    ${typeOfTitle(columns.title)},
    ${typeOfBranch(columns.branch)},
    ${UNMATCHED}
  )`;
