import { useSharedWriting } from '@/hooks/useSharedWriting';

export function SharedWriting({ onWrote }: { onWrote: () => void }): null {
  useSharedWriting(onWrote);

  return null;
}
