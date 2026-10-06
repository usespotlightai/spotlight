import { Binoculars } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { TraceHead } from '@/components/features/trace/list/TraceHead';
import { TraceListSkeleton } from '@/components/features/trace/list/TraceListSkeleton';
import { TraceRow } from '@/components/features/trace/list/TraceRow';
import { TraceSelectionBar } from '@/components/features/trace/list/TraceSelectionBar';
import { TraceVolume } from '@/components/features/trace/list/TraceVolume';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { Notice } from '@/components/shared/Notice';
import { useTeamTraces } from '@/hooks/api/useTeamTraces';
import { failed, loading } from '@/lib/query';
import { rangeOf } from '@/lib/range';
import { taskTracePath } from '@/lib/task';
import { teamSectionPath } from '@/lib/team';
import { useForwardTrail } from '@/lib/trail';

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
  const navigate = useNavigate();
  const trail = useForwardTrail();

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
          {`No traces in the ${rangeOf(range).label.toLowerCase()}. Create a task to leave one.`}
        </EmptyState>
      </Notice>
    );
  }

  const chosen = new Set(selected);

  const toggle = (taskId: string, on: boolean) =>
    setSelected((current) =>
      on ? [...current, taskId] : current.filter((each) => each !== taskId),
    );

  const discuss = () =>
    navigate(teamSectionPath(slug, teamId, 'agent'), {
      state: {
        trail,
        traces: worked
          .filter((trace) => chosen.has(trace.taskId))
          .map(({ taskId, title }) => ({ taskId, title })),
      },
    });

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
              selected={chosen.has(trace.taskId)}
              onSelectedChange={(on) => toggle(trace.taskId, on)}
            />
          ))}
        </ul>
      </div>

      <TraceSelectionBar
        count={selected.length}
        onDiscuss={discuss}
        onClear={() => setSelected([])}
      />
    </div>
  );
}
