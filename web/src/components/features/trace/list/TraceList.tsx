import { Binoculars } from 'lucide-react';
import { useState } from 'react';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { TraceHead } from '@/components/features/trace/list/TraceHead';
import { TraceListSkeleton } from '@/components/features/trace/list/TraceListSkeleton';
import { TraceRow } from '@/components/features/trace/list/TraceRow';
import { TraceSelectionBar } from '@/components/features/trace/list/TraceSelectionBar';
import { TraceVolume } from '@/components/features/trace/list/TraceVolume';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { Notice } from '@/components/shared/Notice';
import { useAnalyseTraces } from '@/hooks/api/useAnalyseTraces';
import { useTeamTraces } from '@/hooks/api/useTeamTraces';
import { failed, loading } from '@/lib/query';
import { rangeOf } from '@/lib/range';
import { taskTracePath } from '@/lib/task';

export function TraceList({
  slug,
  teamId,
  range,
}: {
  slug: string;
  teamId: string;
  range: string;
}) {
  const traces = useTeamTraces(teamId, range);
  const analyseTraces = useAnalyseTraces();

  const [selected, setSelected] = useState<readonly string[]>([]);

  if (loading(traces)) {
    return <TraceListSkeleton />;
  }

  if (failed(traces)) {
    return (
      <Notice>
        <CouldNotLoad
          what="Traces"
          retrying={traces.isFetching}
          onRetry={() => void traces.refetch()}
        />
      </Notice>
    );
  }

  const worked = traces.data ?? [];

  if (worked.length === 0) {
    return (
      <Notice>
        <EmptyState
          icon={Binoculars}
          title="No traces"
          action={<CreateTaskLink slug={slug} teamId={teamId} />}
        >
          {`Nothing was traced in the ${rangeOf(range).label.toLowerCase()}. A task leaves a trace once a station works it.`}
        </EmptyState>
      </Notice>
    );
  }

  const toggle = (taskId: string, on: boolean) =>
    setSelected((current) =>
      on ? [...current, taskId] : current.filter((each) => each !== taskId),
    );

  const analyse = async () => {
    await analyseTraces.mutateAsync({ teamId, taskIds: selected });
    setSelected([]);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <TraceVolume traces={worked} range={range} />

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
        <TraceHead />

        <ul className="flex flex-col">
          {worked.map((trace) => (
            <TraceRow
              key={trace.taskId}
              trace={trace}
              to={taskTracePath(slug, teamId, trace.taskId)}
              selected={selected.includes(trace.taskId)}
              onSelectedChange={(on) => toggle(trace.taskId, on)}
            />
          ))}
        </ul>
      </div>

      <TraceSelectionBar
        count={selected.length}
        pending={analyseTraces.isPending}
        onAnalyse={analyse}
        onClear={() => setSelected([])}
      />
    </div>
  );
}
