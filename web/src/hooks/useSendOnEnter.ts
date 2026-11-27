import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND } from 'lexical';
import { useEffect, useEffectEvent } from 'react';

export function useSendOnEnter(send: () => void, blank = false): void {
  const [editor] = useLexicalComposerContext();
  const sent = useEffectEvent(send);
  const empty = useEffectEvent(() => blank);

  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (event?.shiftKey === true) {
            return false;
          }
          const leavesToPage =
            event !== null && (event.metaKey || event.ctrlKey) && empty();
          if (leavesToPage) {
            return true;
          }
          event?.preventDefault();
          sent();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  );
}
