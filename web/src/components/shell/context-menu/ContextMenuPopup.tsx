import { AppWindow, ExternalLink, Globe, Link, Plus } from 'lucide-react';
import { useMemo, type ReactElement } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import type { WorkspaceLink } from '@/lib/app-tabs';
import type { MenuAction } from '@/lib/context-menu';
import { desktopApp } from '@/lib/desktop';
import { toast } from '@/lib/toast';

export type MenuPoint = { readonly x: number; readonly y: number };

type ContextMenuPopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  at: MenuPoint;
  link: WorkspaceLink | null;
  actions: readonly MenuAction[];
  onOpenTab: (path: string) => void;
};

function OpenOutside({ link }: { link: WorkspaceLink }) {
  const desktop = desktopApp();

  if (desktop?.openWindow) {
    return (
      <DropdownMenuItem onClick={() => desktop.openWindow?.(link.path)}>
        <AppWindow aria-hidden />
        New window
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      onClick={() => window.open(link.href, '_blank', 'noopener')}
    >
      <Globe aria-hidden />
      {desktop ? 'Browser' : 'Browser tab'}
    </DropdownMenuItem>
  );
}

const copyLink = async (href: string) => {
  try {
    await navigator.clipboard.writeText(href);
  } catch {
    toast.add({ type: 'error', title: 'Spotlight could not copy the link' });
    return;
  }

  toast.add({ type: 'success', title: 'Link copied' });
};

export function ContextMenuPopup({
  open,
  onOpenChange,
  at,
  link,
  actions,
  onOpenTab,
}: ContextMenuPopupProps): ReactElement {
  const anchor = useMemo(
    () => ({
      getBoundingClientRect: () =>
        DOMRect.fromRect({ x: at.x, y: at.y, width: 0, height: 0 }),
    }),
    [at.x, at.y],
  );

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuContent
        anchor={anchor}
        side="bottom"
        align="start"
        sideOffset={2}
        className="w-auto min-w-44"
      >
        {actions.map(({ label, icon: Icon, onSelect, disabled }) => (
          <DropdownMenuItem key={label} disabled={disabled} onClick={onSelect}>
            <Icon aria-hidden />
            {label}
          </DropdownMenuItem>
        ))}

        {link && (
          <>
            {actions.length > 0 && <DropdownMenuSeparator />}

            <DropdownMenuItem onClick={() => void copyLink(link.href)}>
              <Link aria-hidden />
              Copy link
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ExternalLink aria-hidden />
                Open in
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-36">
                <DropdownMenuItem onClick={() => onOpenTab(link.path)}>
                  <Plus aria-hidden />
                  New tab
                </DropdownMenuItem>
                <OpenOutside link={link} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
