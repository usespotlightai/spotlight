import type { ReactNode } from 'react';
import { LogoLockup } from '@/components/shared/brand/LogoLockup';
import { cn } from '@/lib/utils';

type AuthScreenProps = {
  logo?: boolean;
  className?: string;
  children: ReactNode;
};

export function AuthScreen({
  logo = true,
  className,
  children,
}: AuthScreenProps) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className={cn('flex flex-col gap-6', className)}>
        {logo && <LogoLockup className="mx-auto" />}
        {children}
      </div>
    </main>
  );
}
