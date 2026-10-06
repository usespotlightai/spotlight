import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type IconAvatarProps = {
  size?: 'sm' | 'md';
  children: ReactNode;
};

export function IconAvatar({ size = 'sm', children }: IconAvatarProps) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground',
        size === 'md'
          ? 'size-[26px] [&_svg]:size-3.5'
          : 'size-6 [&_svg]:size-3.5',
      )}
    >
      {children}
    </span>
  );
}
