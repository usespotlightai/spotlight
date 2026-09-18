import { messageOf } from '@/lib/error';
import { cn } from '@/lib/utils';

type ErrorMessageProps = {
  error: unknown;
  className?: string;
};

export function ErrorMessage({ error, className }: ErrorMessageProps) {
  return (
    <p
      role="alert"
      className={cn('text-center text-destructive text-sm', className)}
    >
      {messageOf(error)}
    </p>
  );
}
