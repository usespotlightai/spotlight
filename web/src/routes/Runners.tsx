import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { NewRunnerDialog } from '@/components/runners/NewRunnerDialog';
import { RunnerCard } from '@/components/runners/RunnerCard';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { Button } from '@/components/ui/button';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useRunners } from '@/hooks/api/useRunners';
import type { Runner } from '@/lib/runner';

export function Runners() {
  const { slug } = useParams();
  const { data: runners, isPending } = useRunners();
  const { data: harnesses } = useHarnesses();
  const [enrolling, setEnrolling] = useState(false);

  if (isPending || !slug) {
    return null;
  }

  const fleet = runners ?? [];

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

      <NewRunnerDialog open={enrolling} onOpenChange={setEnrolling} />

      <SettingsPage
        title="Runners"
        description="The machines that do the work. A runner reports the harnesses it found installed, and is only given work it can carry out."
      >
        <section className="flex flex-col gap-2">
          <h2 className="flex h-6 items-center font-medium text-muted-foreground text-xs">
            Enrolled
          </h2>

          {fleet.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No runner has registered with the control plane.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {fleet.map((runner) => (
                <RunnerCard
                  key={runner.id}
                  runner={runner}
                  harnesses={named(runner, harnesses)}
                />
              ))}
            </ul>
          )}
        </section>
      </SettingsPage>
    </>
  );
}

const named = (
  runner: Runner,
  harnesses: readonly { id: string; name: string }[] | undefined,
): string[] =>
  runner.harnesses.map(
    (id) => harnesses?.find((harness) => harness.id === id)?.name ?? id,
  );
