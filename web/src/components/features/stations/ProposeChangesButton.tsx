import { Button } from '@/components/ui/button';

type ProposeChangesButtonProps = {
  proposing?: boolean;
  disabled: boolean;
  onClick?: () => void;
};

export function ProposeChangesButton({
  proposing = false,
  disabled,
  onClick,
}: ProposeChangesButtonProps) {
  return (
    <Button
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full shadow-none"
    >
      {proposing ? 'Proposing…' : 'Propose changes'}
    </Button>
  );
}
