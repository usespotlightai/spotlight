import { Paperclip } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';

type AttachButtonProps = {
  onAttach: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
};

export function AttachButton({
  onAttach,
  disabled,
  className,
}: AttachButtonProps) {
  const picker = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={className}
        disabled={disabled}
        onClick={() => picker.current?.click()}
        aria-label="Attach files"
      >
        <Paperclip className="size-3.5" />
      </Button>

      <input
        ref={picker}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          onAttach(Array.from(event.target.files ?? []));
          // Emptied, so picking the same file again is still a change.
          event.target.value = '';
        }}
      />
    </>
  );
}
