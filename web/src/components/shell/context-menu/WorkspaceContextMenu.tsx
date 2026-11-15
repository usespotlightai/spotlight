import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  ContextMenuPopup,
  type MenuPoint,
} from '@/components/shell/context-menu/ContextMenuPopup';
import { type WorkspaceLink, workspaceLinkAt } from '@/lib/app-tabs';
import {
  MENU_ACTIONS_ATTRIBUTE,
  MenuActionsContext,
  menuActionsRegistry,
} from '@/lib/context-menu';

type Menu = {
  readonly open: boolean;
  readonly at: MenuPoint;
  readonly link: WorkspaceLink | null;
  readonly region: string | null;
};

const CLOSED: Menu = {
  open: false,
  at: { x: 0, y: 0 },
  link: null,
  region: null,
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
  const [registry] = useState(menuActionsRegistry);
  const [menu, setMenu] = useState<Menu>(CLOSED);
  const actions = useSyncExternalStore(
    (onChange) => registry.watch(menu.region, onChange),
    () => registry.actionsOf(menu.region),
  );

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

    const link = workspaceLinkAt(target, window.location.origin, slug);
    const region =
      target
        .closest(`[${MENU_ACTIONS_ATTRIBUTE}]`)
        ?.getAttribute(MENU_ACTIONS_ATTRIBUTE) ?? null;

    if (!link && registry.actionsOf(region).length === 0) {
      return;
    }

    event.preventDefault();
    setMenu({ open: true, at: pointOf(event, target), link, region });
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
        actions={actions}
        onOpenTab={onOpenTab}
      />
    </MenuActionsContext>
  );
}
