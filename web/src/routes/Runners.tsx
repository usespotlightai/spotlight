import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { HarnessPills } from '@/components/runners/HarnessPills';
import { NewRunnerDialog } from '@/components/runners/NewRunnerDialog';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useRunners } from '@/hooks/api/useRunners';
import { type Runner, standing } from '@/lib/runner';
import { cn } from '@/lib/utils';

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
        <SettingsSection title="Enrolled">
          {fleet.length === 0 ? (
            <p className="py-1.5 text-muted-foreground text-xs">
              No runner has registered with the control plane.
            </p>
          ) : (
            fleet.map((runner) => (
              <SettingsRow
                key={runner.id}
                mark={
                  <span
                    aria-hidden
                    className={cn(
                      'block size-1.5 rounded-full',
                      runner.connected
                        ? 'bg-emerald-500'
                        : 'bg-muted-foreground/40',
                      runner.revokedAt && 'bg-destructive/60',
                    )}
                  />
                }
                title={runner.name}
                description={<HarnessPills names={named(runner, harnesses)} />}
                trailing={standing(runner)}
              />
            ))
          )}
        </SettingsSection>
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
