import type { BriefedMemory } from '@work/application/ports/team-memories.port';
import { REMEMBER_COMMAND } from '@work/domain/services/run-reasoning';

const kindOf = (kind: string): string => kind.replaceAll('-', ' ');

const flat = (body: string): string => body.replace(/\s+/g, ' ').trim();

const RECALL_COMMAND = 'spotlight recall';

const RECALLING = `When you meet something your briefing does not cover — a part of the code you do not know, a failure you cannot explain, a choice the team may already have made — search what the team remembers with \`${RECALL_COMMAND} "<words>"\`, and read one in full, with where it came from, with \`${RECALL_COMMAND} M-12\`.`;

const REMEMBERING = `When you learn something the next run should know and the code will not tell it — why an approach was taken or dropped, a trap in the environment, a correction from a person — propose it with \`${REMEMBER_COMMAND} --kind <kind> --body "…" [--path <path>]\`; a person approves it before the team keeps it.`;

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

  reaching(remembering: boolean): string {
    return [
      '## Recalling and remembering',
      RECALLING,
      remembering ? REMEMBERING : null,
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
