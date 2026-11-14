import { type ReactNode, useCallback, useState } from 'react';
import { Link, useMatch, useParams } from 'react-router';

import { SettingUpWorkspace } from '@/components/features/onboarding/SettingUpWorkspace';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { CommandPalette } from '@/components/shell/command/CommandPalette';
import { AppSidebar } from '@/components/shell/layout/AppSidebar';
import { DashboardLayout } from '@/components/shell/layout/DashboardLayout';
import { AppTabStrip } from '@/components/shell/tabs/AppTabStrip';
import { SplitDropZones } from '@/components/shell/tabs/SplitDropZones';
import { TabDrag } from '@/components/shell/tabs/TabDrag';
import { TabPane } from '@/components/shell/tabs/TabPane';
import { buttonVariants } from '@/components/ui/button-variants';
import { useSettingUp } from '@/hooks/api/useSettingUp';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useAppTabs } from '@/hooks/useAppTabs';
import { useCommandShortcut } from '@/hooks/useCommandShortcut';
import { useDesktopBadge } from '@/hooks/useDesktopBadge';
import { useDesktopCommands } from '@/hooks/useDesktopCommands';
import { useInboxNotifier } from '@/hooks/useInboxNotifier';
import { useLastPlace } from '@/hooks/useLastPlace';
import { useLiveStream } from '@/hooks/useLiveStream';
import { useNarrowViewport } from '@/hooks/useNarrowViewport';
import { useSlideFrom } from '@/hooks/useSlideFrom';
import type { SplitSide } from '@/lib/app-tabs';
import { failed, loading } from '@/lib/query';
import { cn } from '@/lib/utils';
import { WORKSPACE_URL_PREFIX } from '@/lib/workspace';

type WorkspaceProps = {
  pages: ReactNode;
};

export function Workspace({ pages }: WorkspaceProps) {
  const { slug } = useParams();
  const workspace = useWorkspace(slug);
  const inSettings = Boolean(useMatch('/w/:slug/settings/*'));
  const leftAt = useLastPlace(!inSettings);
  const settingUp = useSettingUp(slug, workspace.data);
  const slideFrom = useSlideFrom(inSettings);
  const tabs = useAppTabs(slug ?? '', workspace.data?.teams ?? []);
  const narrow = useNarrowViewport();
  const [searching, setSearching] = useState(false);
  const toggleSearch = useCallback(() => setSearching((open) => !open), []);
  useCommandShortcut(toggleSearch);
  useLiveStream(useInboxNotifier());
  useDesktopBadge(slug);
  useDesktopCommands(slug, tabs);
  const strip = (
    <AppTabStrip
      tabs={tabs.tabs}
      activeId={tabs.activeId}
      splitId={narrow ? undefined : tabs.splitId}
      onSelect={tabs.select}
      onClose={tabs.close}
      canGoBack={tabs.canGoBack}
      canGoForward={tabs.canGoForward}
      onOpen={tabs.open}
      onBack={tabs.back}
      onForward={tabs.forward}
      recent={tabs.recent}
      onRecent={tabs.showRecent}
    />
  );
  const paneOf = (id: string | undefined) => {
    const tab = tabs.tabs.find((each) => each.id === id);

    return (
      tab && (
        <TabPane
          key={tab.id}
          tab={tab}
          pages={pages}
          focused={tab.id === tabs.activeId}
          onFocus={() => tabs.focus(tab.id)}
          onVisit={tabs.visit}
          onReports={tabs.reportsFor(tab.id)}
        />
      )
    );
  };
  const paneIds = tabs.panes.right
    ? [tabs.panes.left, tabs.panes.right]
    : [tabs.panes.left];
  const dropSides = (index: number): SplitSide[] => {
    if (paneIds.length === 1 || narrow) {
      return paneIds[index] === tabs.activeId ? ['left', 'right'] : [];
    }

    return index > 0 ? ['right'] : ['left'];
  };
  const drag = {
    tabs: tabs.tabs,
    activeId: tabs.activeId,
    canPlace: tabs.canPlace,
    onMove: tabs.move,
    onPlace: tabs.place,
  };

  if (!slug) {
    return null;
  }

  if (failed(workspace)) {
    return (
      <TabDrag {...drag}>
        <DashboardLayout tabs={strip}>
          <PageNotice>
            <CouldNotLoad
              what="The workspace"
              retrying={workspace.isFetching}
              onRetry={() => void workspace.refetch()}
            />
          </PageNotice>
        </DashboardLayout>
      </TabDrag>
    );
  }

  if (!loading(workspace) && !workspace.data) {
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
    <TabDrag {...drag}>
      <DashboardLayout
        sidebar={
          workspace.data && (
            <AppSidebar
              slug={slug}
              workspace={workspace.data}
              inSettings={inSettings}
              from={slideFrom}
              leftAt={leftAt}
              onSearch={() => setSearching(true)}
            />
          )
        }
        tabs={strip}
        focused={tabs.panes.left === tabs.activeId ? 'main' : 'split'}
        onCollapse={(section) =>
          tabs.hidePane(section === 'main' ? 'left' : 'right')
        }
        panes={paneIds.map((id, index) => ({
          key: id ?? 'main',
          content: (
            <>
              {paneOf(id)}
              <SplitDropZones sides={dropSides(index)} />
            </>
          ),
        }))}
      />

      {workspace.data && (
        <CommandPalette
          slug={slug}
          workspace={workspace.data}
          open={searching}
          onOpenChange={setSearching}
        />
      )}
    </TabDrag>
  );
}
