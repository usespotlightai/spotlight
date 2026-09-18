import { Plus } from 'lucide-react';
import { useState } from 'react';
import { NewRunnerDialog } from '@/components/features/runners/NewRunnerDialog';
import { RunnerRow } from '@/components/features/runners/RunnerRow';
import { Button } from '@/components/ui/button';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useRunners } from '@/hooks/api/useRunners';
import { harnessesOf } from '@/lib/runner';
import { cn } from '@/lib/utils';

type EnrolRunnersProps = {
  slug: string;
  controlClassName?: string;
};

export function EnrolRunners({ slug, controlClassName }: EnrolRunnersProps) {
  const runners = useRunners(slug);
  const { data: harnesses } = useHarnesses();
  const [enrolling, setEnrolling] = useState(false);

  const fleet = (runners.data ?? []).filter((runner) => !runner.revokedAt);

  return (
    <div className="flex w-full flex-col items-start gap-3">
      {fleet.length > 0 && (
        <ul aria-label="Runners" className="flex w-full flex-col gap-1.5">
          {fleet.map((runner) => (
            <RunnerRow
              key={runner.id}
              runner={runner}
              harnesses={harnessesOf(runner, harnesses)}
            />
          ))}
        </ul>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => setEnrolling(true)}
        className={cn(controlClassName, 'bg-card')}
      >
        <Plus className="size-3.5" aria-hidden />
        {fleet.length > 0 ? 'Enrol another' : 'Enrol one'}
      </Button>

      <NewRunnerDialog
        slug={slug}
        open={enrolling}
        onOpenChange={setEnrolling}
      />
    </div>
  );
}
