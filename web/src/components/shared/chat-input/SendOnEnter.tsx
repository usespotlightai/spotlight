import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND } from 'lexical';
import { useEffect, useEffectEvent } from 'react';

type SendOnEnterProps = {
  send: () => void;
  blank: boolean;
};

export function SendOnEnter({ send, blank }: SendOnEnterProps) {
  const [editor] = useLexicalComposerContext();
  const sent = useEffectEvent(send);
  const empty = useEffectEvent(() => blank);

  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (event?.shiftKey) {
            return false;
          }
          // An empty text bar leaves Mod+Enter to the page, so it can approve a docked approval.
          if (event && (event.metaKey || event.ctrlKey) && empty()) {
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

  return null;
}
