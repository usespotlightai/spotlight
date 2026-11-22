import { FixedAgent } from '@/components/features/stations/FixedAgent';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';
import { ClosedChatInput } from '@/components/shared/chat-input/ClosedChatInput';
import { useStopRun } from '@/hooks/api/useStopRun';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { LINE_SETS_REPOSITORIES } from '@/lib/run';

type ClosedTaskComposerProps = {
  slug: string;
  teamId: string;
  taskId: string | undefined;
  station: string;
  label: string;
  placeholder: string;
  because: string;
  stopRunId?: string | null;
};

export function ClosedTaskComposer({
  slug,
  teamId,
  taskId,
  station,
  label,
  placeholder,
  because,
  stopRunId = null,
}: ClosedTaskComposerProps) {
  const { line, station: current } = useTaskStation(teamId, taskId);
  const stop = useStopRun();
  const agent = line?.stations.find((each) => each.name === station) ?? current;

  return (
    <ClosedChatInput
      slug={slug}
      label={label}
      placeholder={placeholder}
      because={because}
      settings={<FixedAgent agent={agent} />}
      onStop={
        stopRunId ? () => stop.mutate({ teamId, runId: stopRunId }) : undefined
      }
      below={
        <FixedRepositories
          slug={slug}
          repositories={(line?.repositories ?? []).map((each) => each.fullName)}
          because={LINE_SETS_REPOSITORIES}
        />
      }
    />
  );
}
