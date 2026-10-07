import { useState } from 'react';

const NARROWEST = 48;

type ColumnWidths = {
  readonly widths: readonly (number | null)[];
  readonly resize: (column: number, width: number) => void;
  readonly reset: (column: number) => void;
  readonly pin: (widths: readonly number[]) => void;
};

export function useColumnWidths(count: number): ColumnWidths {
  const [chosen, setChosen] = useState<readonly (number | null)[]>([]);
  const widths = Array.from({ length: count }, (_, at) => chosen[at] ?? null);
  const set = (column: number, width: number | null) =>
    setChosen((was) =>
      Array.from({ length: count }, (_, at) =>
        at === column ? width : (was[at] ?? null),
      ),
    );

  return {
    widths,
    resize: (column, width) =>
      set(column, Math.max(NARROWEST, Math.round(width))),
    reset: (column) => set(column, null),
    pin: (measured) =>
      setChosen(
        Array.from({ length: count }, (_, at) => {
          const width = measured[at];
          return width === undefined ? null : Math.round(width);
        }),
      ),
  };
}
