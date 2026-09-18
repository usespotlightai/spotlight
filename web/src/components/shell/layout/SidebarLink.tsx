import type { ComponentType, ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

type SidebarLinkProps = {
  to: string;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
  trailing?: ReactNode;
  active?: boolean;
  children: ReactNode;
};

export function SidebarLink({
  to,
  icon: Icon,
  className,
  trailing,
  active,
  children,
}: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex h-7 items-center gap-2 rounded-md px-2 text-muted-foreground text-sm outline-none transition-colors',
          'hover:bg-border/50 hover:text-foreground',
          (isActive || active) &&
            'bg-border font-medium text-foreground hover:bg-border',
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
}
