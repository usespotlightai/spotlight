import { ApprovalPill } from '@/components/features/inbox/conversation/approval/ApprovalPill';
import type { Approval } from '@/lib/approval';

type ApprovalApproveButtonProps = {
  approval: Approval;
  disabled: boolean;
  title?: string;
  onApprove: () => void;
};

export function ApprovalApproveButton({
  approval,
  disabled,
  title,
  onApprove,
}: ApprovalApproveButtonProps) {
  return (
    <ApprovalPill
      variant="default"
      disabled={disabled}
      title={title}
      onClick={onApprove}
      aria-label={`Approve ${approval.name}`}
    >
      Approve
    </ApprovalPill>
  );
}
