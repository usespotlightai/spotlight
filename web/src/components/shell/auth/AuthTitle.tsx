import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AuthTitleProps = {
  title: ReactNode;
  large?: boolean;
  children: ReactNode;
};

export function AuthTitle({ title, large = false, children }: AuthTitleProps) {
  return (
    <div
      className={cn(
        'flex flex-col text-center text-sm',
        large ? 'gap-2' : 'gap-1',
      )}
    >
      <h1
        className={cn(
          'text-foreground',
          large
            ? 'font-medium text-2xl leading-8 tracking-tight'
            : 'font-medium',
        )}
      >
        {title}
      </h1>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
