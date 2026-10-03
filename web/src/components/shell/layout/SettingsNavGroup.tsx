import type { ReactNode } from 'react';
import { SidebarHeading } from '@/components/shell/layout/SidebarHeading';

type SettingsNavGroupProps = {
  heading: string;
  children: ReactNode;
};

export function SettingsNavGroup({ heading, children }: SettingsNavGroupProps) {
  return (
    <section>
      <SidebarHeading>{heading}</SidebarHeading>

      <ul className="flex flex-col gap-0.5">{children}</ul>
    </section>
  );
}
