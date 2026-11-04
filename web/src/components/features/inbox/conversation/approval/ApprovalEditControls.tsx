import { ApprovalApproveButton } from '@/components/features/inbox/conversation/approval/ApprovalApproveButton';
import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionControls } from '@/components/shared/DecisionControls';
import type { Approval } from '@/lib/approval';

type ApprovalEditControlsProps = {
  approval: Approval;
  pending: boolean;
  blank: boolean;
  onApprove: () => void;
  onCancel: () => void;
};

export function ApprovalEditControls({
  approval,
  pending,
  blank,
  onApprove,
  onCancel,
}: ApprovalEditControlsProps) {
  return (
    <DecisionControls>
      <DecisionButton disabled={pending} onClick={onCancel}>
        Cancel
      </DecisionButton>
      <ApprovalApproveButton
        approval={approval}
        disabled={pending || blank}
        disabledBecause={blank ? 'Fill in every input to approve' : null}
        onApprove={onApprove}
      />
    </DecisionControls>
  );
}
