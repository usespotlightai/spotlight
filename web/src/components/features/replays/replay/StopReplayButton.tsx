import { ConfirmStopButton } from '@/components/shared/ConfirmStopButton';
import { useStopReplay } from '@/hooks/api/useStopReplay';
import { messageOf } from '@/lib/error';

type StopReplayButtonProps = {
  teamId: string;
  replayId: string;
  className?: string;
};

export function StopReplayButton({
  teamId,
  replayId,
  className,
}: StopReplayButtonProps) {
  const stop = useStopReplay();

  return (
    <ConfirmStopButton
      title="Stop this replay?"
      description="Nothing more of it starts, and its running runs are stopped. What has finished keeps its results."
      keep="Keep it running"
      stop="Stop replay"
      pending={stop.isPending}
      error={
        stop.isError ? messageOf(stop.error, 'Could not stop the replay') : null
      }
      onStop={(stopped) =>
        stop.mutate({ teamId, replayId }, { onSuccess: stopped })
      }
      onClosed={() => stop.reset()}
      className={className}
    />
  );
}
