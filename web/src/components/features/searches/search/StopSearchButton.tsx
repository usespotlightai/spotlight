import { ConfirmStopButton } from '@/components/shared/ConfirmStopButton';
import { useStopSearch } from '@/hooks/api/useStopSearch';
import { messageOf } from '@/lib/error';

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
      description="Its agent is stopped and no more candidates are replayed. What has finished keeps its scores, and a candidate whose replay finished can still be picked."
      keep="Keep it searching"
      stop="Stop search"
      pending={stop.isPending}
      error={
        stop.isError ? messageOf(stop.error, 'Could not stop the search') : null
      }
      onStop={(stopped) =>
        stop.mutate({ teamId, searchId }, { onSuccess: stopped })
      }
      onClosed={() => stop.reset()}
      className={className}
    />
  );
}
