import type { ReactNode } from 'react';

type StationLayoutProps = {
  notices?: ReactNode;
  aside: ReactNode;
  children: ReactNode;
};

export function StationLayout({
  notices,
  aside,
  children,
}: StationLayoutProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-8">
        {notices}

        <div className="flex gap-10">
          <main className="flex min-w-0 flex-1 flex-col gap-8">{children}</main>

          {aside}
        </div>
      </div>
    </div>
  );
}
