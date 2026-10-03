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
  onSend: ((message: Outgoing, sent: () => void) => void) | undefined;
  sent: () => void;
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
  sent,
}: ChatSend) {
  const unsendable = disabled || empty || uploading || pending;
  const stopping = !disabled && running && empty ? (onStop ?? null) : null;

  const send = (event?: FormEvent) => {
    event?.preventDefault();

    if (!unsendable) {
      onSend?.(outgoing, sent);
    }
  };

  return { send, unsendable, stopping };
}
