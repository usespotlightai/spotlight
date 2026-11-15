import { type ReactNode, useEffect, useState } from 'react';

import { CommandsContext } from '@/lib/commands/context';
import { type Chord, chordOf, SEQUENCE_MS } from '@/lib/commands/keys';
import { CommandRegistry } from '@/lib/commands/registry';
import { typingIn } from '@/lib/commands/typing';

export function CommandsProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new CommandRegistry());

  useEffect(() => {
    let pending: Chord[] = [];
    let expiry: ReturnType<typeof setTimeout> | undefined;

    const reset = () => {
      pending = [];
      clearTimeout(expiry);
    };

    const pressed = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) {
        return;
      }

      const chord = chordOf(event);
      if (!chord) {
        return;
      }

      const typing = typingIn(event.target);
      const tries =
        pending.length > 0 ? [[...pending, chord], [chord]] : [[chord]];
      reset();

      for (const sequence of tries) {
        const match = registry.match(sequence, typing);

        if (match.kind === 'run') {
          event.preventDefault();
          match.command.run();
          return;
        }

        if (match.kind === 'wait') {
          event.preventDefault();
          pending = sequence;
          expiry = setTimeout(reset, SEQUENCE_MS);
          return;
        }
      }
    };

    document.addEventListener('keydown', pressed);

    return () => {
      reset();
      document.removeEventListener('keydown', pressed);
    };
  }, [registry]);

  return <CommandsContext value={registry}>{children}</CommandsContext>;
}
