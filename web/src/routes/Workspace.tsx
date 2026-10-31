import { useCallback, useState } from 'react';
import { Link, useMatch, useParams } from 'react-router';
import { SettingUpWorkspace } from '@/components/features/onboarding/SettingUpWorkspace';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { CommandPalette } from '@/components/shell/command/CommandPalette';
import { DashboardLayout } from '@/components/shell/layout/DashboardLayout';
import { PageOutlet } from '@/components/shell/layout/PageOutlet';
import { SettingsSidebar } from '@/components/shell/layout/SettingsSidebar';
import { SidebarSlide } from '@/components/shell/layout/SidebarSlide';
import { WorkspaceSidebar } from '@/components/shell/layout/WorkspaceSidebar';
import { AppTabStrip } from '@/components/shell/tabs/AppTabStrip';
import { buttonVariants } from '@/components/ui/button-variants';
import { useSettingUp } from '@/hooks/api/useSettingUp';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useAppTabs } from '@/hooks/useAppTabs';
import { useCommandShortcut } from '@/hooks/useCommandShortcut';
import { useLastPlace } from '@/hooks/useLastPlace';
import { useSlideFrom } from '@/hooks/useSlideFrom';
import { failed, loading } from '@/lib/query';
import { TabTitleContext } from '@/lib/tab-title';
import { cn } from '@/lib/utils';
import { WORKSPACE_URL_PREFIX, workspacePath } from '@/lib/workspace';

export function Workspace() {
  const { slug } = useParams();
  const workspace = useWorkspace(slug);
  const inSettings = Boolean(useMatch('/w/:slug/settings/*'));
  const leftAt = useLastPlace(!inSettings);
  const settingUp = useSettingUp(slug, workspace.data);
  const slideFrom = useSlideFrom(inSettings);
  const tabs = useAppTabs(slug ?? '', workspace.data?.teams ?? []);
  const [searching, setSearching] = useState(false);
  const toggleSearch = useCallback(() => setSearching((open) => !open), []);
  useCommandShortcut(toggleSearch);
  const strip = (
    <AppTabStrip
      tabs={tabs.tabs}
      activeId={tabs.activeId}
      onSelect={tabs.select}
      onClose={tabs.close}
      onOpen={tabs.open}
    />
  );

  if (!slug) {
    return null;
  }

  if (loading(workspace)) {
    return (
      <DashboardLayout tabs={strip}>
        <TabTitleContext value={tabs.report}>
          <PageOutlet />
        </TabTitleContext>
      </DashboardLayout>
    );
  }

  if (failed(workspace)) {
    return (
      <DashboardLayout tabs={strip}>
        <PageNotice>
          <CouldNotLoad
            what="The workspace"
            retrying={workspace.isFetching}
            onRetry={() => void workspace.refetch()}
          />
        </PageNotice>
      </DashboardLayout>
    );
  }

  if (!workspace.data) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
        <h1 className="font-medium text-2xl tracking-tight">
          Workspace not found
        </h1>
        <p className="max-w-sm text-center text-muted-foreground text-sm">
          No workspace exists at {WORKSPACE_URL_PREFIX}
          {slug}, or you’re not a member of it.
        </p>
        <Link
          to="/workspaces/new"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'rounded-full bg-white',
          )}
        >
          Create a workspace
        </Link>
      </main>
    );
  }

  if (settingUp && !inSettings) {
    return <SettingUpWorkspace />;
  }

  return (
    <DashboardLayout
      sidebar={
        <SidebarSlide key={inSettings ? 'settings' : 'app'} from={slideFrom}>
          {inSettings ? (
            <SettingsSidebar
              slug={slug}
              back={leftAt ?? workspacePath(slug)}
              workspace={workspace.data}
            />
          ) : (
            <WorkspaceSidebar
              slug={slug}
              workspace={workspace.data}
              onSearch={() => setSearching(true)}
            />
          )}
        </SidebarSlide>
      }
      tabs={strip}
    >
      <TabTitleContext value={tabs.report}>
        <PageOutlet />
      </TabTitleContext>

      <CommandPalette
        slug={slug}
        workspace={workspace.data}
        open={searching}
        onOpenChange={setSearching}
      />
    </DashboardLayout>
  );
}
