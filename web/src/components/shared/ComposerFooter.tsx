import type { ReactNode } from 'react';

export function ComposerFooter({ children }: { children: ReactNode }) {
  return (
    <div className="relative shrink-0 bg-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-full h-10 bg-gradient-to-t from-surface to-transparent"
      />

      <div className="mx-auto w-full max-w-3xl px-8 pt-2 pb-6">
        <div className="-mx-3">{children}</div>
      </div>
    </div>
  );
}
