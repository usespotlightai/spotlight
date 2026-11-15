import { useCommands } from '@/hooks/useCommands';

const SHOWS_SIDEBAR = '(min-width: 48rem)';

const sidebarShown = () =>
  typeof window.matchMedia !== 'function' ||
  window.matchMedia(SHOWS_SIDEBAR).matches;

export function useSidebarKey(toggle: () => void, enabled: boolean) {
  useCommands(
    enabled
      ? [{ id: 'sidebar.toggle', run: toggle, enabled: sidebarShown }]
      : [],
  );
}
