import type { ComponentType, ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

type SidebarLinkProps = {
  to: string;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
  children: ReactNode;
};

export function SidebarLink({
  to,
  icon: Icon,
  className,
  children,
}: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex h-7 items-center gap-2 rounded-md px-2 text-muted-foreground text-sm outline-none transition-colors',
          'hover:bg-accent hover:text-foreground',
          isActive && 'bg-accent font-medium text-foreground',
          className,
        )
      }
    >
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span className="truncate">{children}</span>
    </NavLink>
  );
}
