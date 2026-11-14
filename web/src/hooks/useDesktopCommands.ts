import { useEffect, useEffectEvent } from 'react';
import { useNavigate } from 'react-router';

import type { AppTab } from '@/lib/app-tabs';
import { desktopApp } from '@/lib/desktop';
import { settingsPath } from '@/lib/settings';

type Tabs = {
  readonly tabs: readonly AppTab[];
  readonly activeId: string;
  select(id: string): void;
  close(id: string): void;
  open(): void;
  back(): void;
  forward(): void;
};

const TAB_AT = /^tab-(\d)$/;

export const tabFor = (
  command: string,
  tabs: readonly AppTab[],
  activeId: string,
): AppTab | null => {
  const at = tabs.findIndex((tab) => tab.id === activeId);
  const numbered = TAB_AT.exec(command);

  if (numbered) {
    return tabs[Number(numbered[1]) - 1] ?? null;
  }

  switch (command) {
    case 'next-tab':
      return tabs[(at + 1) % tabs.length] ?? null;
    case 'previous-tab':
      return tabs[(at - 1 + tabs.length) % tabs.length] ?? null;
    case 'last-tab':
      return tabs.at(-1) ?? null;
    default:
      return null;
  }
};

export function useDesktopCommands(slug: string | undefined, tabs: Tabs) {
  const navigate = useNavigate();

  const heard = useEffectEvent((command: string) => {
    if (command === 'new-tab') {
      tabs.open();
      return;
    }

    if (command === 'back' || command === 'forward') {
      tabs[command]();
      return;
    }

    if (command === 'close-tab') {
      if (tabs.tabs.length > 1) {
        tabs.close(tabs.activeId);
      } else {
        desktopApp()?.close?.();
      }
      return;
    }

    if (command === 'settings') {
      if (slug) {
        void navigate(settingsPath(slug));
      }
      return;
    }

    const tab = tabFor(command, tabs.tabs, tabs.activeId);

    if (tab) {
      tabs.select(tab.id);
    }
  });

  useEffect(() => desktopApp()?.onCommand?.(heard), []);
}
