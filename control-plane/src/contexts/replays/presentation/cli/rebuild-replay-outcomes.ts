// oxlint-disable no-console -- a command-line tool reports on the terminal
import { parseArgs } from 'node:util';

import { openReplayOutcomesRebuild } from '@replays/replays.replay-outcomes-rebuild';

const USAGE =
  'Usage: rebuild-replay-outcomes [--team <id>]\nWithout --team, rebuilds every team.';

async function rebuild(): Promise<void> {
  const { values } = parseArgs({
    options: {
      team: { type: 'string' },
      help: { type: 'boolean' },
    },
  });

  if (values.help) {
    console.log(USAGE);
    return;
  }

  const { outcomes, close } = openReplayOutcomesRebuild();

  try {
    for (const teamId of values.team ? [values.team] : await outcomes.teams()) {
      console.log(
        `Rebuilt ${await outcomes.ofTeam(teamId)} replay outcomes for team ${teamId}.`,
      );
    }
  } finally {
    await close();
  }
}

rebuild().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
