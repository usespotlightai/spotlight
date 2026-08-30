import { Composer } from '@/components/inbox/Composer';
import { useSayToRun } from '@/hooks/api/useSayToRun';

type RunComposerProps = {
  teamId: string;
  runId: string;
  station: string;
};

export function RunComposer({ teamId, runId, station }: RunComposerProps) {
  const say = useSayToRun();

  return (
    <Composer
      label={`Say something to ${station}`}
      placeholder="Say something…"
      pending={say.isPending}
      onSend={(body, sent) =>
        say.mutate({ teamId, runId, body }, { onSuccess: sent })
      }
    />
  );
}
