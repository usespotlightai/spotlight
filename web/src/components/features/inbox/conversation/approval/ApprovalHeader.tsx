import { DecisionActions } from '@/components/shared/DecisionActions';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import {
  type Approval,
  copyText,
  editable,
  standingOf,
  titleOf,
} from '@/lib/approval';

type ApprovalHeaderProps = {
  approval: Approval;
  pending: boolean;
  acting: boolean;
  onEdit?: () => void;
};

export function ApprovalHeader({
  approval,
  pending,
  acting,
  onEdit,
}: ApprovalHeaderProps) {
  return (
    <DecisionHeader
      title={
        <DecisionTitle standing={standingOf(approval)}>
          {titleOf(approval)}
        </DecisionTitle>
      }
      trailing={
        acting && (
          <DecisionActions
            copy={{ text: copyText(approval), label: `Copy ${approval.name}` }}
            editLabel={`Edit ${approval.name}`}
            pending={pending}
            onEdit={editable(approval) ? onEdit : undefined}
          />
        )
      }
    />
  );
}
