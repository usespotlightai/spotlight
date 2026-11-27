// oxlint-disable no-console -- a command-line tool reports on the terminal
import { parseArgs } from 'node:util';

import type { RebuiltRunFacts } from '@insights/application/services/rebuild-run-facts.service';
import { openRunFactsRebuild } from '@insights/insights.run-facts-rebuild';

const USAGE =
  'Usage: rebuild-run-facts [--workspace <id> [--team <id>]]\nWithout --workspace, rebuilds every workspace.';

const reported = ({ owner, rebuilt }: RebuiltRunFacts): void => {
  console.log(`Rebuilt ${rebuilt} run facts for ${owner}.`);
};

const given = (value: string | undefined): value is string =>
  value !== undefined && value !== '';

async function rebuild(): Promise<void> {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string' },
      team: { type: 'string' },
      help: { type: 'boolean' },
    },
  });

  const { workspace, team } = values;
  const asksForHelp = values.help === true;

  if (asksForHelp || (given(team) && !given(workspace))) {
    console.log(USAGE);
    process.exitCode = asksForHelp ? 0 : 1;
    return;
  }

  const { facts, close } = openRunFactsRebuild();

  try {
    if (given(workspace) && given(team)) {
      reported(await facts.ofTeam(workspace, team));
      return;
    }

    await facts.ofWorkspaces(given(workspace) ? [workspace] : null, reported);
  } finally {
    await close();
  }
}

rebuild().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
