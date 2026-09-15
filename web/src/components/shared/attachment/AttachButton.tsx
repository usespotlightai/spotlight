import { Paperclip } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';

type AttachButtonProps = {
  onAttach: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export function AttachButton({
  onAttach,
  disabled,
  label,
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
        <Paperclip className="size-3.5" />
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
