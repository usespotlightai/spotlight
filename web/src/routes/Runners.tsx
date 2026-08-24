import { ChevronDown } from 'lucide-react';
import { Outlet, useParams } from 'react-router';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Disclosure } from '@/components/layout/Disclosure';
import { PageHeader } from '@/components/layout/PageHeader';
import { RunnerRow } from '@/components/runners/RunnerRow';
import { useRunners } from '@/hooks/api/useRunners';
import { useCollapsed } from '@/hooks/useCollapsed';
import { useSidebarWidth } from '@/hooks/useSidebarWidth';
import { byPool, shortRunnerId } from '@/lib/runner';
import { cn } from '@/lib/utils';

const POOLS_STORAGE_KEY = 'spotlight.collapsed-pools';

const FLEET_PANE = {
  storageKey: 'spotlight.fleet-width',
  min: 200,
  max: 480,
  initial: 320,
  label: 'Resize the runner list',
};

export function Runners() {
  const { slug, runnerId } = useParams();
  const { data: runners, isPending } = useRunners();
  const pools = useCollapsed(POOLS_STORAGE_KEY);
  const fleetPane = useSidebarWidth(FLEET_PANE);

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

      <div
        className={cn(
          'flex min-h-0 flex-1',
          fleetPane.resizing && 'cursor-col-resize select-none',
        )}
      >
        <div
          style={{ width: fleetPane.width }}
          className="relative flex shrink-0 flex-col gap-4 overflow-y-auto overflow-x-hidden border-r-[0.5px] border-border p-3"
        >
          {fleet.length === 0 ? (
            <p className="px-2 py-1 text-muted-foreground text-xs">
              No runner has registered with the control plane.
            </p>
          ) : (
            byPool(fleet).map(([pool, inPool]) => {
              const open = pools.isExpanded(pool);

              return (
                <section key={pool}>
                  <h2>
                    <button
                      type="button"
                      onClick={() => pools.toggle(pool)}
                      aria-expanded={open}
                      className="group/pool flex h-7 w-full items-center gap-2 rounded-md px-2 font-medium text-muted-foreground text-xs outline-none transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <span className="truncate">{pool}</span>

                      <ChevronDown
                        className={cn(
                          'ml-auto size-3 shrink-0 transition-all',
                          open
                            ? 'opacity-100'
                            : '-rotate-90 opacity-0 group-hover/pool:opacity-100 group-focus-visible/pool:opacity-100',
                        )}
                        aria-hidden
                      />
                    </button>
                  </h2>

                  <Disclosure open={open} slot="pool-runners">
                    {inPool.map((runner) => (
                      <li key={runner.id}>
                        <RunnerRow
                          slug={slug}
                          runner={runner}
                          selected={runner.id === runnerId}
                        />
                      </li>
                    ))}
                  </Disclosure>
                </section>
              );
            })
          )}

          <div
            {...fleetPane.handleProps}
            className={cn(
              'absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize outline-none',
              'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:opacity-0 after:transition-opacity',
              fleetPane.resizing && 'after:opacity-100',
            )}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </>
  );
}
