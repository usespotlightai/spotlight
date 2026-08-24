import { Outlet, useParams } from 'react-router';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { RunnerRow } from '@/components/runners/RunnerRow';
import { useRunners } from '@/hooks/api/useRunners';
import { byPool, shortRunnerId } from '@/lib/runner';

export function Runners() {
  const { slug, runnerId } = useParams();
  const { data: runners, isPending } = useRunners();

  if (isPending || !slug) {
    return null;
  }

  const fleet = runners ?? [];

  return (
    <>
      <PageHeader
        title={
          <Breadcrumbs
            segments={[
              { label: 'Runners' },
              ...(runnerId ? [{ label: shortRunnerId(runnerId) }] : []),
            ]}
          />
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r-[0.5px] border-border p-3">
          {fleet.length === 0 ? (
            <p className="px-2 py-1 text-muted-foreground text-xs">
              No runner has registered with the control plane.
            </p>
          ) : (
            byPool(fleet).map(([pool, inPool]) => (
              <section key={pool}>
                <div className="flex h-7 items-center gap-2 px-2">
                  <h2 className="font-medium text-muted-foreground text-xs">
                    {pool}
                  </h2>
                </div>

                <div className="flex flex-col gap-0.5">
                  {inPool.map((runner) => (
                    <RunnerRow
                      key={runner.id}
                      slug={slug}
                      runner={runner}
                      selected={runner.id === runnerId}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </>
  );
}
