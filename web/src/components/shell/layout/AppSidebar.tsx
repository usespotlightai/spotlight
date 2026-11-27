import type { ComponentProps } from 'react';

import { SettingsSidebar } from '@/components/shell/layout/SettingsSidebar';
import { SidebarSlide } from '@/components/shell/layout/SidebarSlide';
import { WorkspaceSidebar } from '@/components/shell/layout/WorkspaceSidebar';
import type { SlideFrom } from '@/hooks/useSlideFrom';
import { workspacePath } from '@/lib/workspace';

type AppSidebarProps = {
  slug: string;
  workspace: ComponentProps<typeof WorkspaceSidebar>['workspace'];
  inSettings: boolean;
  from: SlideFrom | null;
  leftAt: string | null;
  onSearch: () => void;
};

export function AppSidebar({
  slug,
  workspace,
  inSettings,
  from,
  leftAt,
  onSearch,
}: AppSidebarProps) {
  return (
    <SidebarSlide key={inSettings ? 'settings' : 'app'} from={from}>
      {inSettings ? (
        <SettingsSidebar
          slug={slug}
          back={leftAt ?? workspacePath(slug)}
          workspace={workspace}
        />
      ) : (
        <WorkspaceSidebar
          slug={slug}
          workspace={workspace}
          onSearch={onSearch}
        />
      )}
    </SidebarSlide>
  );
}
