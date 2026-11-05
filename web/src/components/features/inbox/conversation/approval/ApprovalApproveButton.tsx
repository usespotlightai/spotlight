import { DecisionButton } from '@/components/shared/DecisionButton';
import { DisabledReasonTooltip } from '@/components/shared/DisabledReasonTooltip';
import type { Approval } from '@/lib/approval';

type ApprovalApproveButtonProps = {
  approval: Approval;
  disabled: boolean;
  disabledBecause?: string | null;
  onApprove?: () => void;
};

export function ApprovalApproveButton({
  approval,
  disabled,
  disabledBecause = null,
  onApprove,
}: ApprovalApproveButtonProps) {
  return (
    <DisabledReasonTooltip reason={disabledBecause}>
      {(describedBy) => (
        <DecisionButton
          variant="default"
          disabled={disabled}
          aria-describedby={describedBy}
          onClick={onApprove}
          aria-label={`Approve ${approval.name}`}
        >
          Approve
        </DecisionButton>
      )}
    </DisabledReasonTooltip>
  );
}
