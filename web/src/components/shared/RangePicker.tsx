import { MenuPicker, type PickerOption } from '@/components/shared/MenuPicker';
import { RANGES, rangeOf } from '@/lib/range';

export function RangePicker({
  value,
  onChange,
  ranges = RANGES,
}: {
  value: string;
  onChange: (id: string) => void;
  ranges?: readonly PickerOption[];
}) {
  return (
    <MenuPicker
      label="Time range"
      value={value}
      options={ranges}
      selected={ranges.find((range) => range.id === value) ?? rangeOf(value)}
      onChange={onChange}
    />
  );
}
