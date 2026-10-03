import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND } from 'lexical';
import { useEffect, useEffectEvent } from 'react';

export function SendOnEnter({ send }: { send: () => void }) {
  const [editor] = useLexicalComposerContext();
  const sent = useEffectEvent(send);

  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (event?.shiftKey) {
            return false;
          }
          event?.preventDefault();
          sent();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  );

  return null;
}
