import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type InitialAvatarProps = {
  name: string;
  /** Colour classes for the fallback, e.g. `bg-muted`. */
  className?: string;
};

/**
 * A small rounded-square avatar showing the first character of a name.
 * Decorative: the name it stands for is always beside it, so announcing the
 * initial as well would just repeat it.
 */
export function InitialAvatar({ name, className }: InitialAvatarProps) {
  const [initial] = [...name.trim()];

  return (
    <Avatar aria-hidden size="sm" className="rounded after:rounded">
      <AvatarFallback
        className={cn('rounded text-[0.625rem] uppercase', className)}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
