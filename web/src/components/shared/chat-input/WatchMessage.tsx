import { useWatchMessage } from '@/hooks/useWatchMessage';
import type { Written } from '@/lib/chat-input';

export function WatchMessage({
  onChange,
}: {
  onChange: (written: Written) => void;
}) {
  useWatchMessage(onChange);

  return null;
}
