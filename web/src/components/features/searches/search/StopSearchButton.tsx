import { ConfirmStopButton } from '@/components/shared/ConfirmStopButton';
import { useStopSearch } from '@/hooks/api/useStopSearch';

type StopSearchButtonProps = {
  teamId: string;
  searchId: string;
  className?: string;
};

export function StopSearchButton({
  teamId,
  searchId,
  className,
}: StopSearchButtonProps) {
  const stop = useStopSearch();

  return (
    <ConfirmStopButton
      title="Stop this search?"
      description="The search agent stops and no more candidates replay. Finished replays keep their scores, and you can still pick them."
      keep="Keep it searching"
      stop="Stop search"
      pending={stop.isPending}
      onStop={(stopped) =>
        stop.mutate({ teamId, searchId }, { onSuccess: stopped })
      }
      onClosed={() => stop.reset()}
      className={className}
    />
  );
}
