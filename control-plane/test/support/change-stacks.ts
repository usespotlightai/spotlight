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
    draftedAt: new Date(),
    settledAt: new Date(),
    cohorts: [
      {
        id: 'c1',
        kind: 'change',
        title: 'Say it anew',
        intent: 'Reword the readme',
        layers: [
          {
            id: 'c1.l1',
            title: 'Readme',
            summary: 'Rewords it',
            dependsOn: [],
            ranges: [{ hunk: 'h1' }],
            notes: [{ path: 'README.md', note: 'Reworded' }],
          },
        ],
      },
    ],
    checkCommand: 'npm test',
    spent: {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      costs: [],
      unpriced: 0,
    },
    checkPlacement: placement,
  });
  await db.insert(schema.stackCheck).values({
    stackId,
    runId,
    workspaceId,
    command: 'npm test',
    placement,
    phase: 'waiting',
    waitingSince: new Date(),
  });

  return stackId;
};
