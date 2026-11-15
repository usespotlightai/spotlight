import { type ReactNode, useEffect, useEffectEvent, useState } from 'react';

import {
  ContextMenuPopup,
  type MenuLink,
  type MenuPoint,
} from '@/components/shell/context-menu/ContextMenuPopup';
import { tabPathOf } from '@/lib/app-tabs';
import {
  MENU_ACTIONS_ATTRIBUTE,
  type MenuAction,
  MenuActionsContext,
  type MenuActionsRegistry,
} from '@/lib/context-menu';

type Menu = {
  readonly open: boolean;
  readonly at: MenuPoint;
  readonly link: MenuLink | null;
  readonly actions: readonly MenuAction[];
};

const CLOSED: Menu = {
  open: false,
  at: { x: 0, y: 0 },
  link: null,
  actions: [],
};

const EDITABLE =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

const pointOf = (event: MouseEvent, target: Element): MenuPoint => {
  if (event.clientX !== 0 || event.clientY !== 0) {
    return { x: event.clientX, y: event.clientY };
  }

  const box = target.getBoundingClientRect();

  return { x: box.left, y: box.bottom };
};

const inSelection = (target: Element): boolean => {
  const selection = window.getSelection();

  return Boolean(
    selection && !selection.isCollapsed && selection.containsNode(target, true),
  );
};

type WorkspaceContextMenuProps = {
  slug: string;
  onOpenTab: (path: string) => void;
  children: ReactNode;
};

export function WorkspaceContextMenu({
  slug,
  onOpenTab,
  children,
}: WorkspaceContextMenuProps) {
  const [registry] = useState<MenuActionsRegistry>(() => new Map());
  const [menu, setMenu] = useState<Menu>(CLOSED);

  const opened = useEffectEvent((event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;

    if (
      event.defaultPrevented ||
      !target ||
      target.closest(EDITABLE) ||
      inSelection(target)
    ) {
      return;
    }

    const anchor = target.closest('a[href]');
    const path =
      anchor instanceof HTMLAnchorElement
        ? tabPathOf(anchor.href, window.location.origin, slug)
        : null;
    const region = target.closest(`[${MENU_ACTIONS_ATTRIBUTE}]`);
    const actions =
      registry.get(region?.getAttribute(MENU_ACTIONS_ATTRIBUTE) ?? '') ?? [];

    if (!path && actions.length === 0) {
      return;
    }

    event.preventDefault();
    setMenu({
      open: true,
      at: pointOf(event, target),
      link:
        anchor instanceof HTMLAnchorElement && path
          ? { href: anchor.href, path }
          : null,
      actions,
    });
  });

  useEffect(() => {
    document.addEventListener('contextmenu', opened);

    return () => document.removeEventListener('contextmenu', opened);
  }, []);

  return (
    <MenuActionsContext value={registry}>
      {children}
      <ContextMenuPopup
        open={menu.open}
        onOpenChange={(open) => setMenu((current) => ({ ...current, open }))}
        at={menu.at}
        link={menu.link}
        actions={menu.actions}
        onOpenTab={onOpenTab}
      />
    </MenuActionsContext>
  );
}
