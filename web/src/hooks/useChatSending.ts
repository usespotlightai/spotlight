import { useEffect, useRef } from 'react';

import type { useChatMessage } from '@/hooks/useChatMessage';
import { type ChatSendResult, useChatSend } from '@/hooks/useChatSend';
import type { SharedDraft } from '@/hooks/useSharedDraft';
import type { Outgoing } from '@/lib/chat-input';

const forwardSend = (
  onSend: (message: Outgoing, restore: (error?: unknown) => void) => void,
  outgoing: Outgoing,
  shared: SharedDraft | null,
  latestGeneration: { readonly current: number | undefined },
  restore: () => void,
) => {
  const sentGeneration = shared?.synced ? shared.generation : undefined;

  onSend(
    shared
      ? {
          ...outgoing,
          coAuthors: shared.coAuthors(),
          ...(shared.synced && { draftGeneration: shared.generation }),
        }
      : outgoing,
    () => {
      if (
        sentGeneration === undefined ||
        latestGeneration.current === sentGeneration
      ) {
        restore();
      }
    },
  );
};

type SendingOptions = {
  message: ReturnType<typeof useChatMessage>;
  shared: SharedDraft | null;
  disabled: boolean;
  pending: boolean;
  running: boolean;
  onStop?: () => void;
  onSend?: (message: Outgoing, restore: (error?: unknown) => void) => void;
};

export function useChatSending({
  message,
  shared,
  disabled,
  pending,
  running,
  onStop,
  onSend,
}: SendingOptions): ChatSendResult {
  const latestGeneration = useRef(shared?.generation);
  const generation = shared?.generation;
  useEffect(() => {
    latestGeneration.current = generation;
  }, [generation]);

  return useChatSend({
    outgoing: message.outgoing,
    empty: message.blank,
    uploading: message.uploading,
    disabled,
    pending,
    running,
    onStop,
    onSend:
      onSend &&
      ((outgoing) =>
        forwardSend(
          onSend,
          outgoing,
          shared,
          latestGeneration,
          message.restore,
        )),
    clear: message.release,
  });
}
