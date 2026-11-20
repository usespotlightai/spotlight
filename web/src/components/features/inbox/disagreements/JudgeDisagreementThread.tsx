import type { ReactNode } from 'react';

import { JudgeDisagreementItem } from '@/components/features/inbox/disagreements/JudgeDisagreementItem';
import { InboxDetailLayout } from '@/components/features/inbox/InboxDetailLayout';
import { InboxItemSkeleton } from '@/components/features/inbox/InboxItemSkeleton';
import { RunThread } from '@/components/features/inbox/RunThread';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Dockable } from '@/components/shared/decision-tray/Dockable';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useJudgeDisagreement } from '@/hooks/api/useJudgeDisagreement';
import type { DockedDecision } from '@/lib/decision-tray';
import { notFound } from '@/lib/error';
import {
  cardStateOf,
  claimCardLabel,
  claimDecisionId,
  disputedClaimsOf,
  type JudgeDisagreement,
} from '@/lib/judge-disagreement';
import { failed, loading } from '@/lib/query';

const DISAGREEMENT = 'judge-disagreement';

const dockedOf = (
  disagreement: JudgeDisagreement,
  item: (claim?: number) => ReactNode,
): DockedDecision[] => {
  if (disagreement.state !== 'open') {
    return [];
  }

  const disputed = disputedClaimsOf(disagreement);

  if (disputed.length === 0) {
    return [
      {
        id: DISAGREEMENT,
        kind: 'Judge disagreement',
        label: 'Judge disagreement',
        group: 'Judge disagreements',
        content: item(),
      },
    ];
  }

  return disputed
    .filter((claim) => cardStateOf(disagreement, claim.index) === 'open')
    .map((claim) => ({
      id: claimDecisionId(claim.index),
      kind: 'Judge disagreement',
      label: claimCardLabel(claim.index),
      group: 'Judge disagreements',
      content: item(claim.index),
    }));
};

type JudgeDisagreementThreadProps = {
  slug: string;
  teamId: string;
  disagreementId: string;
  trail: readonly BreadcrumbSegment[];
};

export function JudgeDisagreementThread({
  slug,
  teamId,
  disagreementId,
  trail,
}: JudgeDisagreementThreadProps) {
  const disagreement = useJudgeDisagreement(teamId, disagreementId);

  if (loading(disagreement)) {
    return <InboxItemSkeleton />;
  }

  if (failed(disagreement) && notFound(disagreement.error)) {
    return (
      <InboxDetailLayout trail={trail}>
        <MembersOnly title="You cannot see this question" />
      </InboxDetailLayout>
    );
  }

  if (failed(disagreement) || !disagreement.data) {
    return (
      <InboxDetailLayout trail={trail}>
        <CouldNotLoad
          what="The question"
          retrying={disagreement.isFetching}
          onRetry={() => void disagreement.refetch()}
          className="items-start"
        />
      </InboxDetailLayout>
    );
  }

  const item = (claim?: number) => (
    <JudgeDisagreementItem
      slug={slug}
      teamId={teamId}
      disagreement={disagreement.data}
      claim={claim}
    />
  );

  return (
    <RunThread
      slug={slug}
      teamId={teamId}
      taskId={disagreement.data.taskId}
      runId={disagreement.data.runId}
      trail={trail}
      docked={dockedOf(disagreement.data, item)}
      after={
        disputedClaimsOf(disagreement.data).length > 0 ? (
          item()
        ) : (
          <Dockable id={DISAGREEMENT}>{item()}</Dockable>
        )
      }
    />
  );
}
