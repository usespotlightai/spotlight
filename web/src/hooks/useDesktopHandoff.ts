import { useEffect, useState } from 'react';

import {
  desktopApp,
  desktopLinkOf,
  handOffOnce,
  handoffSkipped,
  opensInDesktop,
  skipHandoff,
} from '@/lib/desktop';

const linkAtLoad = (): string | null =>
  desktopApp() || !opensInDesktop() || handoffSkipped()
    ? null
    : desktopLinkOf(window.location);

export function useDesktopHandoff() {
  const [link, setLink] = useState(linkAtLoad);
  const [atLoad] = useState(link);

  useEffect(() => {
    if (atLoad) {
      handOffOnce(atLoad);
    }
  }, [atLoad]);

  const stayHere = () => {
    skipHandoff();
    setLink(null);
  };

  return { link, stayHere };
}
