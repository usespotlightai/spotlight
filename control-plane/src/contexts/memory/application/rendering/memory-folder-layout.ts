import {
  ELSEWHERE_FOLDER,
  REPOSITORY_FOLDER,
} from '@memory/domain/services/memory-folder';
import type { RunContext } from '@memory/domain/value-objects/run-context';

const WIDEST = 38;

const LEVEL_TEXTS = {
  team: 'the whole team',
  line: 'this line',
  station: 'this station',
  repository: 'a repository, or a file or folder in it',
  elsewhere:
    'learned at other stations about the same repositories; check it still fits here',
} as const;

interface LaidOutFolder {
  readonly folder: string;
  readonly level: keyof typeof LEVEL_TEXTS;
}

export interface FolderContents {
  readonly elsewhere: boolean;
}

export const layoutAt = (
  runContext: RunContext,
  contents: FolderContents,
): LaidOutFolder[] => [
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
  ...(contents.elsewhere && runContext.repositories.length > 0
    ? [
        {
          folder: `${ELSEWHERE_FOLDER}<owner>/<name>/<path>/`,
          level: 'elsewhere',
        } as const,
      ]
    : []),
];

const layout = (runContext: RunContext, contents: FolderContents): string =>
  [
    '```',
    ...layoutAt(runContext, contents).map(
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

export const folderGuideAt = (
  runContext: RunContext,
  contents: FolderContents,
): string => [layout(runContext, contents), looking(runContext)].join('\n\n');
