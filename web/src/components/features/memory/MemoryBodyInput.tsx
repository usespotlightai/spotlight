import type { KeyboardEvent } from 'react';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { MAX_MEMORY_BODY } from '@/lib/memory';

type MemoryBodyInputProps = {
  value: string;
  onChange: (body: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function MemoryBodyInput({
  value,
  onChange,
  onSave,
  onCancel,
}: MemoryBodyInputProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      onSave();
    }
    if (event.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <AutoGrowTextarea
      autoFocus
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder="What the team should remember"
      aria-label="What the team should remember"
      maxLength={MAX_MEMORY_BODY}
      className="-mx-1.5 -my-0.5 min-w-0 rounded-md bg-card px-1.5 py-0.5 text-foreground text-sm leading-5 outline-none ring-1 ring-border placeholder:text-muted-foreground focus-visible:ring-ring/50"
    />
  );
}
