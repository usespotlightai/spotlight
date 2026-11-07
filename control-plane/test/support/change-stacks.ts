import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import * as schema from './schema';

export const awaitingCheck = async (
  db: DrizzleDatabase,
  workspaceId: string,
  placement: string[][],
): Promise<string> => {
  const stackId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.changeStack).values({
    id: stackId,
    runId,
    workspaceId,
    teamId: 'team_checked',
    trial: false,
    state: 'ready',
    files: [
      {
        path: 'README.md',
        previousPath: null,
        status: 'modified',
        binary: false,
        hunks: [
          {
            id: 'h1',
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            patch: '-old\n+new\n',
          },
        ],
      },
    ],
    facts: {
      hunks: [
        {
          hunk: 'h1',
          path: 'README.md',
          fileClass: 'docs',
          incidental: false,
          renamed: false,
          moved: false,
          linkable: false,
          defines: [],
          outside: [],
        },
      ],
      links: [],
      imports: [],
    },
    startedAt: new Date(),
    completedAt: new Date(),
    cohorts: [
      {
        id: 'c1',
        kind: 'change',
        title: 'Say it anew',
        intent: 'Reword the readme',
        joinedBecause: null,
        layers: [
          {
            id: 'c1.l1',
            title: 'Readme',
            summary: 'Rewords it',
            dependsOn: [],
            hunks: [{ hunk: 'h1' }],
            notes: [{ path: 'README.md', note: 'Reworded' }],
          },
        ],
      },
    ],
    checkCommand: 'npm test',
    usage: {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      costs: [],
      unpriced: 0,
    },
    checkPlacement: placement,
    redrafting: false,
    pendingJob: false,
    jobAttempts: 0,
    version: 0,
  });
  await db.insert(schema.stackCheck).values({
    stackId,
    runId,
    workspaceId,
    teamId: 'team_checked',
    recheck: false,
    trial: false,
    command: 'npm test',
    placement,
    status: 'waiting',
    entries: [],
    redraftCount: 0,
    attempts: 0,
    provisionAttempts: 0,
    waitingSince: new Date(),
    version: 0,
  });

  return stackId;
};
