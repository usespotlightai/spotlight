import { Button } from '@/components/ui/button';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useStartTaskRun } from '@/hooks/api/useStartTaskRun';

type RunNotStartedNoticeProps = {
  teamId: string;
  taskId: string;
  station: string;
  harness: string;
};

export function RunNotStartedNotice({
  teamId,
  taskId,
  station,
  harness,
}: RunNotStartedNoticeProps) {
  const start = useStartTaskRun();
  const { data: harnesses } = useHarnesses();
  const agent = harnesses?.find((each) => each.id === harness)?.name ?? harness;
  const still = start.isSuccess && start.data?.runNotStarted !== null;

  return (
    <div
      role="status"
      aria-label="The run did not start"
      data-slot="run-not-started"
      className="flex items-center justify-between gap-3 px-3 pb-2"
    >
      <p className="text-muted-foreground text-xs">
        {start.isError
          ? 'Sorry, Spotlight could not try again. Please try again later.'
          : `Spotlight ${still ? 'still ' : ''}cannot start ${agent} at ${station}. Change the station’s agent, then try again.`}
      </p>

      <Button
        type="button"
        variant="outline"
        size="xs"
        className="shrink-0 rounded-full bg-card"
        disabled={start.isPending}
        onClick={() => start.mutate({ teamId, taskId })}
      >
        Try again
      </Button>
    </div>
  );
}
