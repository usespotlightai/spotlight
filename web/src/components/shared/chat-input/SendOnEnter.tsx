import { useSendOnEnter } from '@/hooks/useSendOnEnter';

export function SendOnEnter({ send }: { send: () => void }) {
  useSendOnEnter(send);

  return null;
}
