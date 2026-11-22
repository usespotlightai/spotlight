import type {
  BriefedMemory,
  MemoryFolder,
} from '@work/application/ports/team-memories.port';
import {
  FORGET_COMMAND,
  REMEMBER_COMMAND,
} from '@work/domain/services/run-reasoning';

const kindOf = (kind: string): string => kind.replaceAll('-', ' ');

const flat = (body: string): string => body.replace(/\s+/g, ' ').trim();

const REMEMBERING = `When you learn something the next run should know and the code will not tell it — why an approach was taken or dropped, a trap in the environment, a correction from a person — propose it with \`${REMEMBER_COMMAND} --kind <kind> --body "…" [--scope <scope>] [--path <path>]\`, choosing the widest scope that is still true; a person approves it before the team stores it. Where you know what replaces a memory that is out of date, add \`--supersedes <handle>\`.`;

const FORGETTING = `Where one no longer applies and nothing replaces it, run \`${FORGET_COMMAND} <handle> --because "…"\`; a person approves it before the team retires it.`;

const COPY =
  'Follow what you find where it bears on your work. The files are only a copy: changing them changes nothing the team remembers.';

interface RestOfMemory {
  readonly folder: MemoryFolder | null;
  readonly briefed: boolean;
}

export const Learned = {
  section(memories: readonly BriefedMemory[]): string | null {
    return memories.length > 0
      ? [
          '## What the team has learned',
          `The team approved these from earlier work, whatever tool it was done with. Follow the ones that bear on what you do. ${FORGETTING}`,
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
      folder.guide,
      COPY,
    ].join('\n\n');
  },

  remembering(): string {
    return ['## Remembering', REMEMBERING].join('\n\n');
  },
};
