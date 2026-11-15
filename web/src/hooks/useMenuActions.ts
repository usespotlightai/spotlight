import { use, useEffect, useId } from 'react';

import { type MenuAction, MenuActionsContext } from '@/lib/context-menu';

export function useMenuActions(actions: readonly MenuAction[]) {
  const registry = use(MenuActionsContext);
  const id = useId();

  useEffect(() => {
    if (!registry || actions.length === 0) {
      return;
    }

    registry.set(id, actions);

    return () => {
      registry.delete(id);
    };
  }, [registry, id, actions]);

  return registry && actions.length > 0 ? { 'data-menu-actions': id } : {};
}
