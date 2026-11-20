import { useSharedWriting } from '@/hooks/useSharedWriting';

export function SharedWriting({ onWrote }: { onWrote: () => void }) {
  useSharedWriting(onWrote);

  return null;
}
