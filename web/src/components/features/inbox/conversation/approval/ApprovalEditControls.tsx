import { ApprovalApproveButton } from '@/components/features/inbox/conversation/approval/ApprovalApproveButton';
import { ApprovalPill } from '@/components/features/inbox/conversation/approval/ApprovalPill';
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
    <div className="flex items-center justify-end gap-1">
      <ApprovalPill disabled={pending} onClick={onCancel}>
        Cancel
      </ApprovalPill>
      <ApprovalApproveButton
        approval={approval}
        disabled={pending || blank}
        title={blank ? 'Fill in every input to approve it' : undefined}
        onApprove={onApprove}
      />
    </div>
  );
}
