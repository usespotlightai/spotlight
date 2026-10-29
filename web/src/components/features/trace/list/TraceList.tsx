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
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInsightsTraces } from '@/hooks/api/useInsightsTraces';
import { narrowedBy, type RunFilter, TRUNCATED_TRACES } from '@/lib/insights';
import { failed, loading } from '@/lib/query';
import { rangeOf } from '@/lib/range';
import { taskTracePath } from '@/lib/task';
import { teamSectionPath } from '@/lib/team';
import { useForwardTrail } from '@/lib/trail';

type TraceListProps = {
  slug: string;
  teamId: string;
  range: string;
  filter: RunFilter;
  onEveryTrace: () => void;
};

export function TraceList({
  slug,
  teamId,
  range,
  filter,
  onEveryTrace,
}: TraceListProps) {
  const traces = useInsightsTraces(teamId, range, filter);
  const navigate = useNavigate();
  const trail = useForwardTrail();
  const narrowed = narrowedBy(filter).length > 0;

  const [selected, setSelected] = useState<readonly string[]>([]);

  if (loading(traces)) {
    return <TraceListSkeleton />;
  }

  if (failed(traces) || !traces.data) {
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

  const data = traces.data;
  const worked = data.traces;

  if (worked.length === 0 && !narrowed) {
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
      <TraceVolume volume={data.volume} from={data.from} to={data.to} />

      <ScrollArea
        className="min-h-0 flex-1"
        contentClassName="min-h-full px-1.5 pb-1.5"
      >
        <TraceHead />

        {data.truncated && (
          <p className="px-3 pb-1 text-muted-foreground text-xs">
            {TRUNCATED_TRACES}
          </p>
        )}

        {worked.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <p className="text-muted-foreground text-sm">No traces match.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full bg-card"
              onClick={onEveryTrace}
            >
              Show every trace
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col">
            {worked.map((trace) => (
              <li key={trace.taskId} data-slot="trace">
                <TraceRow
                  trace={trace}
                  to={taskTracePath(slug, teamId, trace.taskId)}
                  selected={chosen.has(trace.taskId)}
                  onSelectedChange={(on) => toggle(trace.taskId, on)}
                />
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <TraceSelectionBar
        count={selected.length}
        onDiscuss={discuss}
        onClear={() => setSelected([])}
      />
    </div>
  );
}
