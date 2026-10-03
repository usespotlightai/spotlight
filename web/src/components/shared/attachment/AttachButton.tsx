import { Paperclip } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { Button } from '@/components/ui/button';

type AttachButtonProps = {
  onAttach: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
  icon?: ReactNode;
  className?: string;
};

export function AttachButton({
  onAttach,
  disabled,
  label,
  icon,
  className,
}: AttachButtonProps) {
  const picker = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={label ? 'sm' : 'icon-sm'}
        className={className}
        disabled={disabled}
        onClick={() => picker.current?.click()}
        aria-label="Attach files"
      >
        {icon ?? <Paperclip className="size-3.5" />}
        {label}
      </Button>

      <input
        ref={picker}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          onAttach(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
    </>
  );
}
