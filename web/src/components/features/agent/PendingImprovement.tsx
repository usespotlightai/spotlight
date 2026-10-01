import { MousePointer2 } from 'lucide-react';
import { AttachmentChip } from '@/components/shared/attachment/AttachmentChip';
import { ChipRemoveButton } from '@/components/shared/attachment/ChipRemoveButton';
import type { ImprovedStation } from '@/lib/chat';

type PendingImprovementProps = {
  station: ImprovedStation;
  onRemove: () => void;
};

export function PendingImprovement({
  station,
  onRemove,
}: PendingImprovementProps) {
  return (
    <ul aria-label="Station to improve">
      <li>
        <AttachmentChip
          name={station.stationName}
          detail={`Improve · ${station.lineName}`}
          lead={<MousePointer2 className="size-4" aria-hidden />}
          trailing={
            <ChipRemoveButton
              label={`Stop improving ${station.stationName}`}
              onRemove={onRemove}
            />
          }
          className="w-48 max-w-none"
        />
      </li>
    </ul>
  );
}
