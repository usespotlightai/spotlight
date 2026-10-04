import { Pencil } from 'lucide-react';
import { CopyIconAction } from '@/components/shared/CopyIconAction';
import { IconAction } from '@/components/shared/IconAction';

type DecisionActionsProps = {
  copy: { text: string; label: string };
  editLabel: string;
  pending: boolean;
  onEdit?: () => void;
};

export function DecisionActions({
  copy,
  editLabel,
  pending,
  onEdit,
}: DecisionActionsProps) {
  return (
    <div className="flex items-center gap-0.5">
      <CopyIconAction text={copy.text} label={copy.label} />

      {onEdit && (
        <IconAction
          label={editLabel}
          tip="Edit"
          disabled={pending}
          onClick={onEdit}
        >
          <Pencil />
        </IconAction>
      )}
    </div>
  );
}
