import type { ReactElement } from 'react';

import { StationAlertCard } from '@/components/features/inbox/alerts/StationAlertCard';
import { JudgeDisagreementThread } from '@/components/features/inbox/disagreements/JudgeDisagreementThread';
import { InboxDetailLayout } from '@/components/features/inbox/InboxDetailLayout';
import { MemoryThread } from '@/components/features/inbox/memories/MemoryThread';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import type { InboxItem, InboxPart } from '@/lib/inbox';

type InboxRequestPageProps = {
  slug: string;
  item: InboxItem;
  inboxRequest: InboxPart & { readonly about: string };
  trail: readonly BreadcrumbSegment[];
};

export function InboxRequestPage({
  slug,
  item,
  inboxRequest,
  trail,
}: InboxRequestPageProps): ReactElement | null {
  switch (inboxRequest.form) {
    case 'memories':
      return (
        <MemoryThread
          slug={slug}
          teamId={item.teamId}
          taskId={item.taskId}
          runId={inboxRequest.about}
          trail={trail}
        />
      );
    case 'alert':
      return (
        <InboxDetailLayout trail={trail}>
          <StationAlertCard
            slug={slug}
            teamId={item.teamId}
            alertId={inboxRequest.about}
          />
        </InboxDetailLayout>
      );
    case 'judge-disagreement':
      return (
        <JudgeDisagreementThread
          slug={slug}
          teamId={item.teamId}
          disagreementId={inboxRequest.about}
          trail={trail}
        />
      );
    case null:
      return null;
  }
}
