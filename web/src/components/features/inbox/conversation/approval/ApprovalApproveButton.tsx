import { DecisionPill } from '@/components/shared/DecisionPill';
import type { Approval } from '@/lib/approval';

type ApprovalApproveButtonProps = {
  approval: Approval;
  disabled: boolean;
  title?: string;
  onApprove?: () => void;
};

export function ApprovalApproveButton({
  approval,
  disabled,
  title,
  onApprove,
}: ApprovalApproveButtonProps) {
  return (
    <DecisionPill
      variant="default"
      disabled={disabled}
      title={title}
      onClick={onApprove}
      aria-label={`Approve ${approval.name}`}
    >
      Approve
    </DecisionPill>
  );
}
