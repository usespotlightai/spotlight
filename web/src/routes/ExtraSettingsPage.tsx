import { createElement } from 'react';
import { Navigate, useParams } from 'react-router';

import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useSettingsPages } from '@/hooks/api/useSettingsPages';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useNavigateRequests } from '@/hooks/useNavigateRequests';
import { useSettingsPageElement } from '@/hooks/useSettingsPageElement';
import { useShownTheme } from '@/hooks/useShownTheme';
import type { SettingsPageDto } from '@/lib/api';
import { failed } from '@/lib/query';
import type { Role } from '@/lib/role';
import { workspaceGeneralPath } from '@/lib/settings';
import { CONTRACT_VERSION } from '@/lib/settings-page-element';

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
  page: SettingsPageDto;
  slug: string;
  role: Role;
};

// The custom element of a settings page that the deployment adds. Its script comes from this origin and runs as the person who opens the page.
function PageElement({ page, slug, role }: PageElementProps) {
  const theme = useShownTheme();
  const { state, retry } = useSettingsPageElement(page);

  const ref = useNavigateRequests<HTMLElement>(state === 'ready');

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
    role,
    theme,
    'contract-version': CONTRACT_VERSION,
  });
}

export function ExtraSettingsPage() {
  const { slug, pageId } = useParams();
  const pages = useSettingsPages();
  const workspace = useWorkspace(slug);

  if (!slug) {
    return null;
  }

  if (failed(pages)) {
    return (
      <SettingsPage title="Settings">
        <SettingsSection>
          <CouldNotLoad
            what="This page"
            retrying={pages.isFetching}
            onRetry={() => void pages.refetch()}
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

  if (!page || !role || !page.roles.includes(role)) {
    return <Navigate to={workspaceGeneralPath(slug)} replace />;
  }

  return (
    <SettingsPage title={page.label}>
      <PageElement key={page.id} page={page} slug={slug} role={role} />
    </SettingsPage>
  );
}
