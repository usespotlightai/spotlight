import { SAVING_GRADE } from '@/lib/judge';

type GradeSavingProps = {
  pending: boolean;
};

export function GradeSaving({ pending }: GradeSavingProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="text-muted-foreground text-xs empty:hidden"
    >
      {pending ? SAVING_GRADE : null}
    </span>
  );
}
