import { PillButton } from '@/components/shared/PillButton';

export function ThisWasWrong({ onClick }: { onClick: () => void }) {
  return <PillButton onClick={onClick}>This was wrong</PillButton>;
}
