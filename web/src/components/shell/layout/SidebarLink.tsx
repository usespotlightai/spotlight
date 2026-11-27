import type { ComponentType, ReactNode } from 'react';
import { NavLink } from 'react-router';

import { ShortcutHint } from '@/components/shared/shortcut/ShortcutHint';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useActiveCommand } from '@/hooks/useActiveCommand';
import { shortcutOf } from '@/lib/commands/shortcuts';
import { cn } from '@/lib/utils';

type SidebarLinkProps = {
  to: string;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
  trailing?: ReactNode;
  hint?: string;
  active?: boolean;
  children: ReactNode;
};

export function SidebarLink({
  to,
  icon: Icon,
  className,
  trailing,
  hint,
  active,
  children,
}: SidebarLinkProps) {
  const command = useActiveCommand({ to });
  const link = (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex h-7 items-center pointer-coarse:h-11 gap-2 rounded-md px-2 text-muted-foreground text-sm outline-none transition-colors',
          'hover:bg-sidebar-hover hover:text-foreground',
          (isActive || active) &&
            'bg-sidebar-selected font-medium text-foreground hover:bg-sidebar-selected',
          className,
        )
      }
    >
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span className="truncate">{children}</span>
      {trailing !== undefined && (
        <span className="ml-auto shrink-0 tabular-nums">{trailing}</span>
      )}
    </NavLink>
  );

  if (!command) {
    return link;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right" align="center">
        <ShortcutHint id={command.id}>
          {command.title ?? shortcutOf(command.id).title}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </ShortcutHint>
      </TooltipContent>
    </Tooltip>
  );
}
