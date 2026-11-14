// oxlint-disable no-console -- a command-line tool reports on the terminal
import { parseArgs } from 'node:util';

import { openAcp1JournalsRewrite } from '@runs/runs.acp-1-journals-rewrite';

const USAGE = [
  'Usage: rewrite-acp-1-journals [--run <id>] [--write]',
  'Rewrites the ACP 1 journals of runs that are not running into harness events.',
  'Without --write, reports what it would rewrite and changes nothing.',
].join('\n');

async function rewrite(): Promise<void> {
  const { values } = parseArgs({
    options: {
      run: { type: 'string' },
      write: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });

  if (values.help) {
    console.log(USAGE);
    return;
  }

  const write = values.write ?? false;
  const { journals, close } = openAcp1JournalsRewrite();
  let rewritten = 0;

  try {
    for (const attempt of await journals.attempts(values.run ?? null)) {
      const done = await journals.rewrite(attempt, write);
      if (done) {
        rewritten++;
        console.log(
          `${write ? 'Rewrote' : 'Would rewrite'} run ${done.runId} attempt ${done.attempt}: ${done.before} rows to ${done.after} rows.`,
        );
      }
    }

    console.log(
      `${write ? 'Rewrote' : 'Would rewrite'} ${rewritten} journal ${rewritten === 1 ? 'attempt' : 'attempts'}.`,
    );
  } finally {
    await close();
  }
}

rewrite().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
