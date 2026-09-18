import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { HoveredLine } from '@/components/shared/PatchCodeDiff';

const DIGIT_PX = 6.6;
const NUMBER_INSET_PX = 8.6;
const HALF_PLUS_PX = 8;

export function ReviewGutterPlus({ hovered }: { hovered: HoveredLine }) {
  const plus = useRef<HTMLSpanElement>(null);
  const [digits, setDigits] = useState(1);

  useEffect(() => {
    const host = plus.current?.closest('diffs-container');

    if (!host) {
      return;
    }

    const follow = () => {
      const line = hovered();

      if (line) {
        setDigits(String(line.lineNumber).length);
      }
    };

    host.addEventListener('pointermove', follow);
    return () => host.removeEventListener('pointermove', follow);
  }, [hovered]);

  return (
    <span
      ref={plus}
      aria-hidden
      style={{
        marginRight: NUMBER_INSET_PX + (digits * DIGIT_PX) / 2 - HALF_PLUS_PX,
      }}
      className="pointer-events-none flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-primary text-white shadow-xs"
    >
      <Plus className="size-3" strokeWidth={2.5} />
    </span>
  );
}
