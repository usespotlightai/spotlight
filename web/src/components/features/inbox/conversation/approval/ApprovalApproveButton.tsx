import { DecisionPill } from '@/components/shared/DecisionPill';
import { RefusalTooltip } from '@/components/shared/RefusalTooltip';
import type { Approval } from '@/lib/approval';

type ApprovalApproveButtonProps = {
  approval: Approval;
  disabled: boolean;
  refusedBecause?: string | null;
  onApprove?: () => void;
};

export function ApprovalApproveButton({
  approval,
  disabled,
  refusedBecause = null,
  onApprove,
}: ApprovalApproveButtonProps) {
  return (
    <RefusalTooltip reason={refusedBecause}>
      {(describedBy) => (
        <DecisionPill
          variant="default"
          disabled={disabled}
          aria-describedby={describedBy}
          onClick={onApprove}
          aria-label={`Approve ${approval.name}`}
        >
          Approve
        </DecisionPill>
      )}
    </RefusalTooltip>
  );
}
