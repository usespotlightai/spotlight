import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { NewRunnerDialog } from '@/components/features/runners/NewRunnerDialog';
import { RunnerCard } from '@/components/features/runners/RunnerCard';
import { RunnerCardSkeleton } from '@/components/features/runners/RunnerCardSkeleton';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useRunners } from '@/hooks/api/useRunners';
import { failed, loading } from '@/lib/query';
import { harnessesOf } from '@/lib/runner';

const FLEET = 'grid gap-2 sm:grid-cols-2';

export function Runners() {
  const { slug } = useParams();
  const runners = useRunners(slug);
  const { data: harnesses } = useHarnesses();
  const [enrolling, setEnrolling] = useState(false);

  if (!slug) {
    return null;
  }

  const fleet = runners.data ?? [];

  return (
    <>
      <PageHeader
        title={<Breadcrumbs segments={[{ label: 'Runners' }]} />}
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

      <NewRunnerDialog
        slug={slug}
        open={enrolling}
        onOpenChange={setEnrolling}
      />

      <SettingsPage
        title="Runners"
        description="The machines that do the work. A runner reports the harnesses it found installed, and is only given work it can carry out."
      >
        <section className="flex flex-col gap-2">
          <h2 className="flex h-6 items-center font-medium text-muted-foreground text-xs">
            Enrolled
          </h2>

          {loading(runners) && (
            <ul
              role="status"
              aria-label="Loading the runners"
              className={FLEET}
            >
              <RunnerCardSkeleton />
            </ul>
          )}

          {failed(runners) && (
            <CouldNotLoad
              what="Runners"
              retrying={runners.isFetching}
              onRetry={() => void runners.refetch()}
              className="items-start"
            />
          )}

          {runners.data?.length === 0 && (
            <div className="flex flex-col items-start gap-4">
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
                Register a new runner
              </Button>
            </div>
          )}

          {fleet.length > 0 && (
            <ul className={FLEET}>
              {fleet.map((runner) => (
                <RunnerCard
                  key={runner.id}
                  runner={runner}
                  harnesses={harnessesOf(runner, harnesses)}
                />
              ))}
            </ul>
          )}
        </section>
      </SettingsPage>
    </>
  );
}
