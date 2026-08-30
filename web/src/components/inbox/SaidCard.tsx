import type { ReactNode } from 'react';

/**
 * The frame around what a person put in. Set apart from the work it prompted,
 * which runs plainly down the page. Its own padding is what its holder's
 * negative inset cancels, so the words inside line up with the plain text.
 */
export function SaidCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2">
      {children}
    </div>
  );
}
