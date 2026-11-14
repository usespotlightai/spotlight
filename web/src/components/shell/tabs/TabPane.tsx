import { type ReactNode, Suspense, use, useMemo } from 'react';
import {
  createPath,
  type Navigator,
  parsePath,
  Route,
  Router,
  Routes,
  type To,
  UNSAFE_LocationContext,
  UNSAFE_NavigationContext,
  UNSAFE_RouteContext,
} from 'react-router';

import { PageErrorBoundary } from '@/components/shell/layout/PageErrorBoundary';
import { type AppTab, type Place, placeAt } from '@/lib/app-tabs';
import { type TabReports, TabTitleContext } from '@/lib/tab-title';

type TabPaneProps = {
  tab: AppTab;
  pages: ReactNode;
  focused: boolean;
  onFocus: () => void;
  onVisit: (id: string, place: Place) => void;
  onReports: TabReports;
};

const OUTSIDE_ANY_ROUTER = null as never;

const OUTSIDE_ANY_ROUTE = { outlet: null, matches: [], isDataRoute: false };

const hrefOf = (to: To) => (typeof to === 'string' ? to : createPath(to));

export function TabPane({
  tab,
  pages,
  focused,
  onFocus,
  onVisit,
  onReports,
}: TabPaneProps) {
  const windowNavigator = use(UNSAFE_NavigationContext).navigator;
  const inPane = useMemo<Navigator>(() => {
    const visit = (to: To, state?: unknown) =>
      onVisit(tab.id, placeAt(hrefOf(to), state));

    return { createHref: hrefOf, push: visit, replace: visit, go: () => {} };
  }, [onVisit, tab.id]);

  const location = {
    ...parsePath(tab.path),
    state: tab.state ?? null,
    key: tab.path,
  };

  return (
    <div
      data-slot="tab-pane"
      className="contents"
      onPointerDownCapture={onFocus}
      onFocusCapture={onFocus}
    >
      <UNSAFE_LocationContext value={OUTSIDE_ANY_ROUTER}>
        <UNSAFE_RouteContext value={OUTSIDE_ANY_ROUTE}>
          <Router
            location={location}
            navigator={focused ? windowNavigator : inPane}
          >
            <TabTitleContext value={onReports}>
              <PageErrorBoundary>
                <Suspense fallback={null}>
                  <Routes>
                    <Route path="/w/:slug">{pages}</Route>
                  </Routes>
                </Suspense>
              </PageErrorBoundary>
            </TabTitleContext>
          </Router>
        </UNSAFE_RouteContext>
      </UNSAFE_LocationContext>
    </div>
  );
}
