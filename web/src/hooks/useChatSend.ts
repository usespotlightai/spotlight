import type { FormEvent } from 'react';
import type { Outgoing } from '@/lib/chat-input';

type ChatSend = {
  outgoing: Outgoing;
  empty: boolean;
  uploading: boolean;
  disabled: boolean;
  pending: boolean;
  running: boolean;
  onStop: (() => void) | undefined;
  onSend: ((message: Outgoing) => void) | undefined;
  clear: () => void;
};

export function useChatSend({
  outgoing,
  empty,
  uploading,
  disabled,
  pending,
  running,
  onStop,
  onSend,
  clear,
}: ChatSend) {
  const unsendable = disabled || empty || uploading || pending;
  const stopping = !disabled && running && empty ? (onStop ?? null) : null;

  const send = (event?: FormEvent) => {
    event?.preventDefault();

    if (!unsendable) {
      clear();
      onSend?.(outgoing);
    }
  };

  return { send, unsendable, stopping };
}
