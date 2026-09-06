import { Check } from 'lucide-react';
import { STATION_PALETTE } from '@/lib/station';

const WHEEL =
  'conic-gradient(#db5b52, #e2894a, #edc12b, #56b98d, #4bb3cd, #5c66d9, #ce9f9c, #db5b52)';

type StationColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

export function StationColorPicker({
  value,
  onChange,
}: StationColorPickerProps) {
  return (
    <div
      data-slot="station-color-picker"
      className="flex items-center gap-1.5 p-0.5"
    >
      {STATION_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={color}
          aria-pressed={color === value}
          style={{ backgroundColor: color }}
          className="flex size-5 shrink-0 items-center justify-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {color === value && (
            <Check className="size-3 text-white" strokeWidth={3.5} />
          )}
        </button>
      ))}

      <span className="h-4 w-px shrink-0 bg-border" aria-hidden />

      <label
        style={{ background: WHEEL }}
        className="relative size-5 shrink-0 cursor-pointer rounded-full transition-transform hover:scale-110"
      >
        <span className="sr-only">Custom colour</span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
