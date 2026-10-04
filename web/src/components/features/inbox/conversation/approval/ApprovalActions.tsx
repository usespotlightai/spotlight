import { Pencil } from 'lucide-react';
import { ApprovalCopyButton } from '@/components/features/inbox/conversation/approval/ApprovalCopyButton';
import { IconAction } from '@/components/shared/IconAction';
import { type Approval, editable } from '@/lib/approval';

type ApprovalActionsProps = {
  approval: Approval;
  pending: boolean;
  onEdit?: () => void;
};

export function ApprovalActions({
  approval,
  pending,
  onEdit,
}: ApprovalActionsProps) {
  return (
    <div className="flex items-center gap-0.5">
      <ApprovalCopyButton approval={approval} />

      {onEdit && editable(approval) && (
        <IconAction
          label={`Edit ${approval.name}`}
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
