import { ApprovalApproveButton } from '@/components/features/inbox/conversation/approval/ApprovalApproveButton';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionPill } from '@/components/shared/DecisionPill';
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
      <DecisionPill disabled={pending} onClick={onCancel}>
        Cancel
      </DecisionPill>
      <ApprovalApproveButton
        approval={approval}
        disabled={pending || blank}
        disabledBecause={blank ? 'Fill in every input to approve' : null}
        onApprove={onApprove}
      />
    </DecisionControls>
  );
}
