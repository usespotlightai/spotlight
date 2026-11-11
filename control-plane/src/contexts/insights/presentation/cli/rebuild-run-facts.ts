// oxlint-disable no-console -- a command-line tool reports on the terminal
import { parseArgs } from 'node:util';

import type { RebuiltRunFacts } from '@insights/application/services/rebuild-run-facts.service';
import { openRunFactsRebuild } from '@insights/insights.run-facts-rebuild';

const USAGE =
  'Usage: rebuild-run-facts [--workspace <id> [--team <id>]]\nWithout --workspace, rebuilds every workspace.';

const reported = ({ owner, rebuilt }: RebuiltRunFacts): void => {
  console.log(`Rebuilt ${rebuilt} run facts for ${owner}.`);
};

async function rebuild(): Promise<void> {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string' },
      team: { type: 'string' },
      help: { type: 'boolean' },
    },
  });

  if (values.help || (values.team && !values.workspace)) {
    console.log(USAGE);
    process.exitCode = values.help ? 0 : 1;
    return;
  }

  const { facts, close } = openRunFactsRebuild();

  try {
    if (values.workspace && values.team) {
      reported(await facts.ofTeam(values.workspace, values.team));
      return;
    }

    await facts.ofWorkspaces(
      values.workspace ? [values.workspace] : null,
      reported,
    );
  } finally {
    await close();
  }
}

rebuild().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
