import type {
  BriefedMemory,
  MemoryFolder,
} from '@work/application/ports/team-memories.port';
import { REMEMBER_COMMAND } from '@work/domain/services/run-reasoning';

const kindOf = (kind: string): string => kind.replaceAll('-', ' ');

const flat = (body: string): string => body.replace(/\s+/g, ' ').trim();

const REMEMBERING = `When you learn something the next run should know and the code will not tell it — why an approach was taken or dropped, a trap in the environment, a correction from a person — propose it with \`${REMEMBER_COMMAND} --kind <kind> --body "…" [--path <path>]\`; a person approves it before the team keeps it.`;

const looking = (folder: MemoryFolder): string =>
  [
    'Look there before you:',
    folder.mirroring
      ? `- change code you do not know: the same path under \`${folder.mirroring}\`, and the folders above it;`
      : null,
    '- choose between approaches: grep for what you are deciding, since a rejected approach may already be written down;',
    '- chase a failure you cannot explain: grep for the error, the test or the service.',
  ]
    .filter(Boolean)
    .join('\n');

const COPY =
  'Follow what you find where it bears on your work. The files are only a copy: changing them changes nothing the team remembers.';

const WIDEST = 38;

interface RestOfMemory {
  readonly folder: MemoryFolder | null;
  readonly briefed: boolean;
}

const layout = (folder: MemoryFolder): string =>
  [
    '```',
    ...folder.layout.map((row) => `${row.folder.padEnd(WIDEST)}${row.level}`),
    '```',
  ].join('\n');

export const Learned = {
  section(memories: readonly BriefedMemory[]): string | null {
    return memories.length > 0
      ? [
          '## What the team has learned',
          'The team kept these from earlier work, whatever tool it was done with. Follow the ones that bear on what you do. Where one no longer applies, say so in your note and name it by its handle.',
          memories
            .map(
              (each) =>
                `- **${each.handle}** · ${kindOf(each.kind)}: ${flat(each.body)}`,
            )
            .join('\n'),
        ].join('\n\n')
      : null;
  },

  rest(rest: RestOfMemory): string | null {
    const { folder } = rest;

    if (!folder) {
      return null;
    }

    return [
      '## The rest of what the team remembers',
      `${rest.briefed ? 'The list above is only what bears most closely on this work. ' : ''}Everything the team remembers that applies here is in \`${folder.path}/\` in the workspace, one file per memory, named by its handle and laid out by where it applies:`,
      layout(folder),
      looking(folder),
      COPY,
    ].join('\n\n');
  },

  remembering(): string {
    return ['## Remembering', REMEMBERING].join('\n\n');
  },
};
