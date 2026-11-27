import type { ReactElement } from 'react';

import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionControls } from '@/components/shared/DecisionControls';

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
}: ProposedMemoryControlsProps): ReactElement {
  return (
    <DecisionControls>
      {editing ? (
        <DecisionButton disabled={pending} onClick={onCancel}>
          Cancel
        </DecisionButton>
      ) : (
        <DecisionButton
          disabled={pending || !onReject}
          onClick={onReject}
          aria-label={`Reject memory ${position}`}
          aria-describedby={bodyId}
        >
          Reject
        </DecisionButton>
      )}
      <DecisionButton
        variant="default"
        data-focus-next
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
      </DecisionButton>
    </DecisionControls>
  );
}
