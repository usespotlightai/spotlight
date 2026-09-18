import type { ComponentType, ReactNode } from 'react';
import { Disclosure } from '@/components/shell/layout/Disclosure';
import { DisclosureRow } from '@/components/shell/layout/DisclosureRow';

type SidebarGroupProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  slot: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function SidebarGroup({
  label,
  icon,
  slot,
  open,
  onToggle,
  children,
}: SidebarGroupProps) {
  return (
    <li>
      <DisclosureRow
        label={label}
        icon={icon}
        open={open}
        onToggle={onToggle}
        className="pl-8"
      />

      <Disclosure open={open} slot={slot}>
        {children}
      </Disclosure>
    </li>
  );
}
