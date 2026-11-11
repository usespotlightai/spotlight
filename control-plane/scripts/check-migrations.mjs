// oxlint-disable no-console -- a command-line tool reports on the terminal
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [, , base = 'origin/develop'] = process.argv;
const JOURNAL = 'drizzle/meta/_journal.json';

const atBase = (path) =>
  execFileSync('git', ['show', `${base}:./${path}`], { encoding: 'utf8' });

const entriesOf = (text) => JSON.parse(text).entries;

const sqlOf = (tag) => `drizzle/${tag}.sql`;

const before = entriesOf(atBase(JOURNAL));
const after = entriesOf(readFileSync(JOURNAL, 'utf8'));
const problems = [];

before.forEach((applied, index) => {
  const now = after[index];

  if (!now || now.tag !== applied.tag || now.when !== applied.when) {
    problems.push(
      `${applied.tag} is on ${base}, so staging has run it. Keep it as entry ${index} of ${JOURNAL} with "when" ${applied.when}, and add a new migration instead.`,
    );
    return;
  }

  if (readFileSync(sqlOf(now.tag), 'utf8') !== atBase(sqlOf(applied.tag))) {
    problems.push(
      `${sqlOf(applied.tag)} differs from ${base}. Staging has run it, so it cannot change. Add a new migration instead.`,
    );
  }
});

const newest = before.at(-1)?.when ?? 0;

after.slice(before.length).reduce((previous, added) => {
  if (added.when <= previous) {
    problems.push(
      `${added.tag} has "when" ${added.when}, which is not after ${previous}. Drizzle skips a migration older than the last one a database ran. Generate it again on top of ${base}.`,
    );
  }

  return Math.max(previous, added.when);
}, newest);

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`::error::${problem}`);
  }
  process.exit(1);
}

console.log(
  `${after.length - before.length} new migration(s) on top of ${before.length} from ${base}.`,
);
