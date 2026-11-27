import { useEffect, useState } from 'react';

import {
  desktopApp,
  desktopLinkOf,
  handOffOnce,
  handoffSkipped,
  opensInDesktop,
  skipHandoff,
} from '@/lib/desktop';
import { nonEmpty } from '@/lib/non-empty';

const linkAtLoad = (): string | null =>
  desktopApp() || !opensInDesktop() || handoffSkipped()
    ? null
    : desktopLinkOf(window.location);

type DesktopHandoffResult = { link: string | null; stayHere: () => void };

export function useDesktopHandoff(): DesktopHandoffResult {
  const [link, setLink] = useState(linkAtLoad);
  const [atLoad] = useState(link);

  useEffect(() => {
    if (nonEmpty(atLoad)) {
      handOffOnce(atLoad);
    }
  }, [atLoad]);

  const stayHere = () => {
    skipHandoff();
    setLink(null);
  };

  return { link, stayHere };
}
