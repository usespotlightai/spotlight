import type { ReactNode } from 'react';

import {
  ChangeStackNotice,
  type StackNoticeBack,
} from '@/components/features/changes/ChangeStackNotice';
import { ChangeStackView } from '@/components/features/changes/ChangeStackView';
import { StackPushOrigin } from '@/components/features/changes/StackPushOrigin';
import { StackRepositoryPills } from '@/components/features/changes/StackRepositoryPills';
import { DecisionsProvider } from '@/components/features/decisions/DecisionsProvider';
import { ReviewProvider } from '@/components/features/review/ReviewProvider';
import { SubmitReviewButton } from '@/components/features/review/SubmitReviewButton';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useStackInView } from '@/hooks/useStackInView';
import type { ChangeStack } from '@/lib/change-stack';
import type { CodeReview } from '@/lib/review';
import { StackVisitorContext } from '@/lib/review-context';

type StackInView = ReturnType<typeof useStackInView>;

type ChangeStackLayoutProps = {
  view: StackInView;
  title: ReactNode;
  actions: ReactNode;
  back: StackNoticeBack | null;
};

function ChangeStackLayout({
  view: { current, stack, layerId, pick, switchTo },
  title,
  actions,
  back,
}: ChangeStackLayoutProps) {
  const ready = stack?.state === 'ready' ? stack : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={title}
        trailing={
          ready && (
            <>
              <StackPushOrigin stack={ready} />
              <StackRepositoryPills
                stacks={current}
                stack={ready}
                onChange={switchTo}
                className="hidden shrink grow justify-end-safe pr-2 @4xl/pane:flex"
              />
            </>
          )
        }
        actions={ready && actions}
      />

      {ready && (
        <StackRepositoryPills
          stacks={current}
          stack={ready}
          onChange={switchTo}
          className="border-border border-b-[0.5px] @md/pane:px-4 @4xl/pane:hidden"
        />
      )}

      {ready ? (
        <ChangeStackView stack={ready} layerId={layerId} onPick={pick} />
      ) : (
        <ChangeStackNotice stack={stack} back={back} />
      )}
    </div>
  );
}

type ChangeStackPageProps = {
  slug: string;
  teamId: string;
  taskId: string | null | undefined;
  stacks: readonly ChangeStack[];
  review: CodeReview | undefined;
  trail: readonly BreadcrumbSegment[];
  back: StackNoticeBack;
};

export function ChangeStackPage({
  slug,
  teamId,
  taskId,
  stacks,
  review,
  trail,
  back,
}: ChangeStackPageProps) {
  const view = useStackInView(stacks);

  return (
    <ReviewProvider
      teamId={teamId}
      taskId={taskId}
      repository={view.stack?.repository ?? null}
      alone={view.current.length <= 1}
      review={review}
    >
      <DecisionsProvider slug={slug} teamId={teamId} taskId={taskId}>
        <ChangeStackLayout
          view={view}
          title={<Breadcrumbs segments={trail} />}
          actions={taskId ? <SubmitReviewButton /> : undefined}
          back={back}
        />
      </DecisionsProvider>
    </ReviewProvider>
  );
}

type PublicChangeStackPageProps = {
  stacks: readonly ChangeStack[];
  signedIn: boolean;
};

export function PublicChangeStackPage({
  stacks,
  signedIn,
}: PublicChangeStackPageProps) {
  const view = useStackInView(stacks);

  return (
    <StackVisitorContext value={{ signedIn }}>
      <ChangeStackLayout
        view={view}
        title="Change stack"
        actions={undefined}
        back={null}
      />
    </StackVisitorContext>
  );
}
