import { DecisionButton } from '@/components/shared/DecisionButton';
import { cn } from '@/lib/utils';

type SaveCancelButtonsProps = {
  saving: boolean;
  unsaveable: boolean;
  onSave: () => void;
  onCancel: () => void;
  className?: string;
};

export function SaveCancelButtons({
  saving,
  unsaveable,
  onSave,
  onCancel,
  className,
}: SaveCancelButtonsProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DecisionButton
        type="button"
        variant="default"
        disabled={unsaveable}
        onClick={onSave}
      >
        {saving ? 'Saving…' : 'Save'}
      </DecisionButton>
      <DecisionButton type="button" onClick={onCancel}>
        Cancel
      </DecisionButton>
    </div>
  );
}
