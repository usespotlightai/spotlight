import { DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { TaskPreview } from '@/components/features/board/task/TaskPreview';
import type { StationResponseDto } from '@/lib/api';
import { stationShare } from '@/lib/station';
import type { Task } from '@/lib/task';

const UNPLACED_COLOR = '#a3a8b0';

type LiftedTaskOverlayProps = {
  stations: readonly StationResponseDto[];
  lifted: Task | null;
};

export function LiftedTaskOverlay({
  stations,
  lifted,
}: LiftedTaskOverlayProps) {
  const place = lifted
    ? stations.findIndex((each) => each.id === lifted.stationId)
    : -1;

  return (
    <DragOverlay
      dropAnimation={{
        duration: 140,
        easing: 'ease-out',
        sideEffects: defaultDropAnimationSideEffects({
          styles: { active: { opacity: '1' } },
        }),
        keyframes: ({ transform }) => [
          {
            opacity: 1,
            transform: CSS.Transform.toString(transform.initial),
          },
          {
            opacity: 0,
            transform: CSS.Transform.toString(transform.initial),
          },
        ],
      }}
    >
      {lifted && (
        <TaskPreview
          task={lifted}
          stationColor={stations[place]?.color ?? UNPLACED_COLOR}
          stationShare={stationShare(place, stations.length)}
        />
      )}
    </DragOverlay>
  );
}
