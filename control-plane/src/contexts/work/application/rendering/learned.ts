import type { BriefedMemory } from '@work/application/ports/team-memories.port';

const kindOf = (kind: string): string => kind.replaceAll('-', ' ');

const flat = (body: string): string => body.replace(/\s+/g, ' ').trim();

export const Learned = {
  section(memories: readonly BriefedMemory[]): string | null {
    return memories.length > 0
      ? [
          '## What the team has learned',
          'The team kept these from earlier work, whatever tool it was done with. Follow the ones that bear on what you do. Where one no longer holds, say so in your note and name it by its handle.',
          memories
            .map(
              (each) =>
                `- **${each.handle}** · ${kindOf(each.kind)}: ${flat(each.body)}`,
            )
            .join('\n'),
        ].join('\n\n')
      : null;
  },
};
