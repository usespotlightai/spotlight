import { parseArgs } from 'node:util';
import { DrizzleRunFactProjection } from '@insights/infrastructure/persistence/drizzle/projections/run-fact.projection';
import {
  runFact,
  runRecord,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { parseDatabaseEnv } from '@platform/config/env';
import { createDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { union } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

const USAGE =
  'Usage: rebuild-run-facts [--workspace <id> [--team <id>]]\nWithout --workspace, rebuilds every workspace.';

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

  const pool = new Pool({ connectionString: parseDatabaseEnv().DATABASE_URL });
  const db = createDatabase(pool);
  const facts = new DrizzleRunFactProjection(new DrizzleContext(db));

  try {
    if (values.workspace && values.team) {
      const rebuilt = await facts.rebuild({
        kind: 'team',
        workspaceId: values.workspace,
        teamId: values.team,
      });
      console.log(`Rebuilt ${rebuilt} run facts for team ${values.team}.`);
      return;
    }

    const workspaceIds = values.workspace
      ? [values.workspace]
      : (
          await union(
            db
              .selectDistinct({ workspaceId: runRecord.workspaceId })
              .from(runRecord),
            db
              .selectDistinct({ workspaceId: runFact.workspaceId })
              .from(runFact),
          )
        ).map((each) => each.workspaceId);

    for (const workspaceId of workspaceIds) {
      const rebuilt = await facts.rebuild({ kind: 'workspace', workspaceId });
      console.log(`Rebuilt ${rebuilt} run facts for workspace ${workspaceId}.`);
    }
  } finally {
    await pool.end();
  }
}

rebuild().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
