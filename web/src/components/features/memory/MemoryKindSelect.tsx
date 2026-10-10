import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { KIND_OPTIONS, type MemoryKind } from '@/lib/memory';

type MemoryKindSelectProps = {
  value: MemoryKind;
  onChange: (kind: string | null) => void;
};

export function MemoryKindSelect({ value, onChange }: MemoryKindSelectProps) {
  return (
    <ChoiceSelect
      compact
      label="Kind"
      choices={KIND_OPTIONS}
      value={value}
      placeholder="Kind"
      className="w-full rounded-md"
      onChange={onChange}
    />
  );
}
