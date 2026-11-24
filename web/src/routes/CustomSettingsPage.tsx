import { createElement } from 'react';
import { Navigate, useParams } from 'react-router';

import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useCustomSettingsPages } from '@/hooks/api/useCustomSettingsPages';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useCustomSettingsPageElement } from '@/hooks/useCustomSettingsPageElement';
import { useNavigationRequests } from '@/hooks/useNavigationRequests';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { CustomSettingsPageDto } from '@/lib/api';
import { CONTRACT_VERSION } from '@/lib/custom-settings-page-element';
import { failed } from '@/lib/query';
import type { Role } from '@/lib/role';
import { seesCustomSettingsPage, workspaceGeneralPath } from '@/lib/settings';

function PageLoading() {
  return (
    <SettingsSection>
      <div className="flex flex-col gap-3 px-4 py-4">
        <SkeletonLine className="w-48 text-sm" />
        <SkeletonLine className="w-72 text-sm" />
        <SkeletonLine className="w-56 text-sm" />
      </div>
    </SettingsSection>
  );
}

type PageElementProps = {
  page: CustomSettingsPageDto;
  slug: string;
  role: Role;
};

// The custom element of a custom settings page. Its script comes from this origin and runs as the person who opens the page.
function PageElement({ page, slug, role }: PageElementProps) {
  const theme = useResolvedTheme();
  const { state, retry } = useCustomSettingsPageElement(page);

  const ref = useNavigationRequests<HTMLElement>(state === 'ready');

  if (state === 'failed') {
    return (
      <SettingsSection>
        <CouldNotLoad
          what={`The ${page.label} page`}
          retrying={false}
          onRetry={retry}
          className="items-start px-4 py-3"
        />
      </SettingsSection>
    );
  }

  if (state === 'loading') {
    return <PageLoading />;
  }

  return createElement(page.element, {
    ref,
    workspace: slug,
    'workspace-role': role,
    theme,
    'contract-version': CONTRACT_VERSION,
  });
}

export function CustomSettingsPage() {
  const { slug, pageId } = useParams();
  const pages = useCustomSettingsPages();
  const workspace = useWorkspace(slug);

  if (!slug) {
    return null;
  }

  if (failed(pages) || failed(workspace)) {
    const retrying = pages.isFetching || workspace.isFetching;
    const retry = () => {
      if (failed(pages)) {
        void pages.refetch();
      }
      if (failed(workspace)) {
        void workspace.refetch();
      }
    };

    return (
      <SettingsPage title="Settings">
        <SettingsSection>
          <CouldNotLoad
            what="This page"
            retrying={retrying}
            onRetry={retry}
            className="items-start px-4 py-3"
          />
        </SettingsSection>
      </SettingsPage>
    );
  }

  if (!pages.data || workspace.data === undefined) {
    return null;
  }

  const page = pages.data.find((each) => each.id === pageId);
  const role = workspace.data?.role;

  if (!page || !role || !seesCustomSettingsPage(page, role)) {
    return <Navigate to={workspaceGeneralPath(slug)} replace />;
  }

  return (
    <SettingsPage title={page.label}>
      <PageElement key={page.id} page={page} slug={slug} role={role} />
    </SettingsPage>
  );
}
