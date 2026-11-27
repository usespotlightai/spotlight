import { Link, useLocation, useParams } from 'react-router';

import { PublicChangeStackPage } from '@/components/features/changes/ChangeStackPage';
import { ChangeStackSkeleton } from '@/components/features/changes/ChangeStackSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Logo } from '@/components/shared/icons';
import { PageNotice } from '@/components/shared/PageNotice';
import { buttonVariants } from '@/components/ui/button-variants';
import {
  usePublicRunChangeStacks,
  usePublicTaskChangeStacks,
} from '@/hooks/api/usePublicChangeStacks';
import { useSession } from '@/hooks/api/useSession';
import { nonEmpty } from '@/lib/non-empty';
import { failed, loading } from '@/lib/query';
import { cn } from '@/lib/utils';

export function PublicChangeStack() {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user);
  const { taskId, runId } = useParams();
  const location = useLocation();
  const task = usePublicTaskChangeStacks(taskId);
  const run = usePublicRunChangeStacks(runId);
  const stacks = nonEmpty(taskId) ? task : run;

  return (
    <div className="@container/pane flex h-dvh flex-col bg-surface">
      <div className="flex h-12 shrink-0 items-center justify-between border-border border-b-[0.5px] px-4">
        <span className="inline-flex items-center gap-2 font-medium text-foreground text-sm">
          <Logo className="size-5" aria-hidden />
          Spotlight
        </span>

        {!signedIn && (
          <Link
            to="/login"
            state={{ from: location }}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'rounded-full bg-card shadow-none',
            )}
          >
            Log in
          </Link>
        )}
      </div>

      {loading(stacks) ? (
        <ChangeStackSkeleton known={[]} />
      ) : failed(stacks) ? (
        <PageNotice>
          <CouldNotLoad
            what="The change stack"
            retrying={stacks.isFetching}
            onRetry={() => void stacks.refetch()}
          />
        </PageNotice>
      ) : stacks.data ? (
        <PublicChangeStackPage
          stacks={stacks.data.stacks}
          signedIn={signedIn}
        />
      ) : (
        <PageNotice>
          <p className="text-muted-foreground text-sm">
            This change stack is not public, or it does not exist.
          </p>
        </PageNotice>
      )}
    </div>
  );
}
