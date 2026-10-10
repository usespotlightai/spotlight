import { PillButton } from '@/components/shared/PillButton';
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
      <PillButton
        type="button"
        variant="default"
        disabled={unsaveable}
        onClick={onSave}
      >
        {saving ? 'Saving…' : 'Save'}
      </PillButton>
      <PillButton type="button" onClick={onCancel}>
        Cancel
      </PillButton>
    </div>
  );
}
