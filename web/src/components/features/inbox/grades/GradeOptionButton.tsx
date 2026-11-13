import { PillButton } from '@/components/shared/PillButton';

type GradeOptionButtonProps = {
  label: string;
  chosen: boolean;
  pending: boolean;
  onClick: () => void;
};

export function GradeOptionButton({
  label,
  chosen,
  pending,
  onClick,
}: GradeOptionButtonProps) {
  return (
    <PillButton
      variant={chosen ? 'default' : 'outline'}
      aria-pressed={chosen}
      disabled={pending}
      className="min-w-10 touch-manipulation pointer-coarse:h-9 tabular-nums"
      onClick={onClick}
    >
      {label}
    </PillButton>
  );
}
