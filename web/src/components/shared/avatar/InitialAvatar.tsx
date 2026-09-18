import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type InitialAvatarProps = {
  name: string;
  className?: string;
};

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
