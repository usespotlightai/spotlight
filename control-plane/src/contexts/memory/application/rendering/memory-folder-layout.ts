import { REPOSITORY_FOLDER } from '@memory/domain/services/memory-folder';
import type { RunContext } from '@memory/domain/value-objects/run-context';

const WIDEST = 38;

const LEVEL_TEXTS = {
  team: 'the whole team',
  line: 'this line',
  station: 'this station',
  repository: 'a repository, or a file or folder in it',
} as const;

interface LaidOutFolder {
  readonly folder: string;
  readonly level: keyof typeof LEVEL_TEXTS;
}

export const layoutAt = (runContext: RunContext): LaidOutFolder[] => [
  { folder: 'team/', level: 'team' },
  ...(runContext.lineId ? [{ folder: 'line/', level: 'line' } as const] : []),
  ...(runContext.stationId
    ? [{ folder: 'station/', level: 'station' } as const]
    : []),
  ...(runContext.repositories.length > 0
    ? [
        {
          folder: `${REPOSITORY_FOLDER}<owner>/<name>/<path>/`,
          level: 'repository',
        } as const,
      ]
    : []),
];

const layout = (runContext: RunContext): string =>
  [
    '```',
    ...layoutAt(runContext).map(
      (row) => `${row.folder.padEnd(WIDEST)}${LEVEL_TEXTS[row.level]}`,
    ),
    '```',
  ].join('\n');

const looking = (runContext: RunContext): string =>
  [
    'Look there before you:',
    runContext.repositories.length > 0
      ? `- change code you do not know: the same path under \`${REPOSITORY_FOLDER}\`, and the folders above it;`
      : null,
    '- choose between approaches: grep for what you are deciding, since a rejected approach may already be written down;',
    '- chase a failure you cannot explain: grep for the error, the test or the service.',
  ]
    .filter(Boolean)
    .join('\n');

export const folderGuideAt = (runContext: RunContext): string =>
  [layout(runContext), looking(runContext)].join('\n\n');
