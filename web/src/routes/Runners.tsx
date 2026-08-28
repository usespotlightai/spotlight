import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Outlet, useParams } from 'react-router';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { NewRunnerDialog } from '@/components/runners/NewRunnerDialog';
import { RunnerRow } from '@/components/runners/RunnerRow';
import { Button } from '@/components/ui/button';
import { useRunners } from '@/hooks/api/useRunners';
import { useSidebarWidth } from '@/hooks/useSidebarWidth';
import { cn } from '@/lib/utils';

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
  const fleetPane = useSidebarWidth(FLEET_PANE);
  const [enrolling, setEnrolling] = useState(false);

  if (isPending || !slug) {
    return null;
  }

  const fleet = runners ?? [];
  const selected = fleet.find((runner) => runner.id === runnerId);

  return (
    <>
      <PageHeader
        title={
          <Breadcrumbs
            segments={[
              { label: 'Runners' },
              ...(selected ? [{ label: selected.name }] : []),
            ]}
          />
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEnrolling(true)}
            className="rounded-full bg-card shadow-none"
          >
            <Plus className="size-3.5" aria-hidden />
            New runner
          </Button>
        }
      />

      <NewRunnerDialog open={enrolling} onOpenChange={setEnrolling} />

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
            <div className="flex flex-col items-start gap-3 px-2 py-1">
              <p className="text-muted-foreground text-xs">
                No runner has registered with the control plane.
              </p>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setEnrolling(true)}
                className="rounded-full bg-card shadow-none"
              >
                <Plus className="size-3.5" aria-hidden />
                New runner
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col">
              {fleet.map((runner) => (
                <li key={runner.id}>
                  <RunnerRow
                    slug={slug}
                    runner={runner}
                    selected={runner.id === runnerId}
                  />
                </li>
              ))}
            </ul>
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
