import { ConfirmStopButton } from '@/components/shared/ConfirmStopButton';
import { useStopReplay } from '@/hooks/api/useStopReplay';

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
      description="Running runs stop and no more start. Finished runs keep their results."
      keep="Keep it running"
      stop="Stop replay"
      pending={stop.isPending}
      onStop={(stopped) =>
        stop.mutate({ teamId, replayId }, { onSuccess: stopped })
      }
      onClosed={() => stop.reset()}
      className={className}
    />
  );
}
