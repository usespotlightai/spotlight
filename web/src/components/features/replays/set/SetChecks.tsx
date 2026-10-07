import { ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { CardList } from '@/components/features/replays/CardList';
import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { RowsSkeleton } from '@/components/features/replays/RowsSkeleton';
import { StateBox } from '@/components/features/replays/StateBox';
import { CheckRow } from '@/components/features/replays/set/CheckRow';
import { GUARDS_ANCHOR } from '@/components/features/replays/set/GuardsChangesToggle';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { useReplaySetChecks } from '@/hooks/api/useReplaySetChecks';
import { failed, loading } from '@/lib/query';
import type { ReplaySet } from '@/lib/replay';
import { cn } from '@/lib/utils';

type SetChecksProps = {
  teamId: string;
  set: ReplaySet;
};

export function SetChecks({ teamId, set }: SetChecksProps) {
  const checks = useReplaySetChecks(teamId, set.id);
  const listed = checks.data?.pages.flat() ?? [];

  let body: ReactNode;

  if (loading(checks)) {
    body = <RowsSkeleton label="Loading the checks" />;
  } else if (failed(checks)) {
    body = (
      <StateBox>
        <CouldNotLoad
          what="The set’s checks"
          retrying={checks.isFetching}
          onRetry={() => void checks.refetch()}
        />
      </StateBox>
    );
  } else if (listed.length === 0) {
    body = (
      <StateBox>
        <EmptyState
          icon={ShieldCheck}
          title="No checks yet"
          action={
            set.guardsChanges ? undefined : (
              <a
                href={`#${GUARDS_ANCHOR}`}
                className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}
              >
                Let it guard config changes
              </a>
            )
          }
        >
          {set.guardsChanges
            ? 'Checks appear when spotlight replay check replays a pull request’s change on this set.'
            : 'Set doesn’t guard config changes. Let it guard them to check pull requests here.'}
        </EmptyState>
      </StateBox>
    );
  } else {
    body = (
      <>
        <CardList label="Checks">
          {listed.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </CardList>
        {checks.hasNextPage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-center"
            disabled={checks.isFetchingNextPage}
            onClick={() => void checks.fetchNextPage()}
          >
            {checks.isFetchingNextPage ? 'Loading…' : 'Show older checks'}
          </Button>
        )}
      </>
    );
  }

  return (
    <section aria-labelledby="set-checks" className="flex flex-col gap-2">
      <ReplaysHeading title="Checks" id="set-checks" level="h2" />
      {body}
    </section>
  );
}
