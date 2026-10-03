import { useState } from 'react';
import { useParams } from 'react-router';
import { Board } from '@/components/features/board/Board';
import { BoardSkeleton } from '@/components/features/board/BoardSkeleton';
import { NotFound } from '@/components/features/board/NotFound';
import { AddTaskDialog } from '@/components/features/board/task/AddTaskDialog';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { TrailSkeleton } from '@/components/shared/skeleton/TrailSkeleton';
import { ViewPills } from '@/components/shared/ViewPills';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useLines } from '@/hooks/api/useLines';
import { useTasks } from '@/hooks/api/useTasks';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useBoardView } from '@/hooks/useBoardView';
import { BOARD_VIEWS } from '@/lib/board';
import { failed, loading } from '@/lib/query';
import { teamPath } from '@/lib/team';
import { teamCrumb } from '@/lib/team-crumb';
import { TrailContext, useTrail } from '@/lib/trail';

export function LineBoard() {
  const { slug, teamId, lineId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const lines = useLines(teamId);
  const tasks = useTasks(teamId);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [view, showView] = useBoardView();
  const [adding, setAdding] = useState<string | null>(null);

  const line = lines.data?.find((candidate) => candidate.id === lineId);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  const { trail, forward } = useTrail([
    ...(team && slug ? [teamCrumb(slug, team)] : []),
    { label: line?.name ?? '' },
  ]);

  if (!slug || !teamId) {
    return null;
  }

  if (failed(lines)) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The line"
          retrying={lines.isFetching}
          onRetry={() => void lines.refetch()}
        />
      </PageNotice>
    );
  }

  if (failed(tasks)) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The tasks"
          retrying={tasks.isFetching}
          onRetry={() => void tasks.refetch()}
        />
      </PageNotice>
    );
  }

  if (!loading(lines) && !line) {
    return (
      <NotFound title="Line not found" to={teamPath(slug, teamId)}>
        This team has no line at that address.
      </NotFound>
    );
  }

  return (
    <TrailContext value={forward}>
      <PageHeader
        title={
          line ? (
            <Breadcrumbs segments={trail} />
          ) : (
            <TrailSkeleton known={trail.slice(0, -1)} />
          )
        }
      />

      <ViewPills
        views={BOARD_VIEWS}
        current={view}
        onChange={(next) => {
          showView(next);
          setSelected([]);
        }}
      />

      {!line || loading(tasks) ? (
        <BoardSkeleton />
      ) : (
        <Board
          slug={slug}
          teamId={teamId}
          line={line}
          tasks={tasks.data ?? []}
          view={view}
          selected={selected}
          onSelectedChange={setSelected}
          onAddTask={setAdding}
        />
      )}

      {line && (
        <AddTaskDialog
          slug={slug}
          teamId={teamId}
          line={line}
          stationId={adding}
          onClose={() => setAdding(null)}
        />
      )}
    </TrailContext>
  );
}
