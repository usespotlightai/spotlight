import { use, useEffect, useId, useRef } from 'react';

import { type MenuAction, MenuActionsContext } from '@/lib/context-menu';

type MenuActionsResult = { 'data-menu-actions'?: string };

export function useMenuActions(
  actions: readonly MenuAction[],
): MenuActionsResult {
  const registry = use(MenuActionsContext);
  const id = useId();
  const latest = useRef(actions);
  const offered = registry !== null && actions.length > 0;

  useEffect(() => {
    latest.current = actions;
    registry?.changed(id);
  });

  useEffect(() => {
    if (!registry || !offered) {
      return;
    }

    return registry.offer(id, () => latest.current);
  }, [registry, id, offered]);

  return offered ? { 'data-menu-actions': id } : {};
}
