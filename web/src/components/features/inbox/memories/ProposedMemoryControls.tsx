import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionPill } from '@/components/shared/DecisionPill';

type ProposedMemoryControlsProps = {
  position: number;
  pending: boolean;
  editing: boolean;
  ready: boolean;
  bodyId: string;
  onApprove?: () => void;
  onReject?: () => void;
  onCancel: () => void;
};

export function ProposedMemoryControls({
  position,
  pending,
  editing,
  ready,
  bodyId,
  onApprove,
  onReject,
  onCancel,
}: ProposedMemoryControlsProps) {
  return (
    <DecisionControls>
      {editing ? (
        <DecisionPill disabled={pending} onClick={onCancel}>
          Cancel
        </DecisionPill>
      ) : (
        <DecisionPill
          disabled={pending || !onReject}
          onClick={onReject}
          aria-label={`Reject memory ${position}`}
          aria-describedby={bodyId}
        >
          Reject
        </DecisionPill>
      )}
      <DecisionPill
        variant="default"
        disabled={pending || !ready || !onApprove}
        onClick={onApprove}
        aria-label={
          editing
            ? `Approve memory ${position} as edited`
            : `Approve memory ${position}`
        }
        aria-describedby={bodyId}
      >
        Approve
      </DecisionPill>
    </DecisionControls>
  );
}
