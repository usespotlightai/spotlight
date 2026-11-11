import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type InitialAvatarProps = {
  name: string;
  src?: string | null;
  size?: 'sm' | 'lg';
  className?: string;
};

export function InitialAvatar({
  name,
  src,
  size = 'sm',
  className,
}: InitialAvatarProps) {
  const [initial] = Array.from(name.trim());

  return (
    <Avatar
      aria-hidden
      size={size}
      className={cn(
        'after:rounded',
        size === 'lg'
          ? 'rounded-lg after:rounded-lg data-[size=lg]:size-9'
          : 'rounded',
      )}
    >
      {src && (
        <AvatarImage
          src={src}
          alt=""
          className={size === 'lg' ? 'rounded-lg' : 'rounded'}
        />
      )}
      <AvatarFallback
        className={cn(
          size === 'lg'
            ? 'rounded-lg text-sm uppercase'
            : 'rounded text-[0.625rem] uppercase',
          className,
        )}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
