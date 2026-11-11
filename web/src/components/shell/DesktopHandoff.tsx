import { type ReactNode, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  desktopApp,
  desktopLinkOf,
  handOffOnce,
  handoffSkipped,
  openInDesktop,
  opensInDesktop,
  skipHandoff,
} from '@/lib/desktop';

const linkAtLoad = (): string | null =>
  desktopApp() || !opensInDesktop() || handoffSkipped()
    ? null
    : desktopLinkOf(window.location);

export function DesktopHandoff({ children }: { children: ReactNode }) {
  const [link, setLink] = useState(linkAtLoad);
  const [atLoad] = useState(link);

  useEffect(() => {
    if (atLoad) {
      handOffOnce(atLoad);
    }
  }, [atLoad]);

  if (!link) {
    return children;
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="flex flex-col gap-1">
        <h1 className="font-medium text-foreground text-sm">
          Opened in the Spotlight desktop app.
        </h1>
        <p className="text-muted-foreground text-sm">
          If the app did not open, it is not installed on this computer.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => openInDesktop(link)}>
          Open the app again
        </Button>
        <Button
          size="sm"
          onClick={() => {
            skipHandoff();
            setLink(null);
          }}
        >
          Open here instead
        </Button>
      </div>
    </main>
  );
}
