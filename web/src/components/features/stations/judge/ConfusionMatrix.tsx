import { useId } from 'react';
import type { RubricVersion } from '@/lib/judge';

export function ConfusionMatrix({
  confusion,
}: {
  confusion: RubricVersion['confusion'];
}) {
  const captionId = useId();

  return (
    <div className="flex flex-col gap-1 text-xs">
      <p id={captionId} className="text-muted-foreground">
        The judge’s scores down, people’s across
      </p>
      <table
        data-slot="confusion-matrix"
        aria-labelledby={captionId}
        className="w-fit border-collapse tabular-nums"
      >
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Judge
            </th>
            {confusion.labels.map((label) => (
              <th
                key={label}
                scope="col"
                className="px-2 py-1 text-center font-normal text-muted-foreground"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {confusion.cells.map((row, at) => {
            const label = confusion.labels[at] ?? '';

            return (
              <tr key={label}>
                <th
                  scope="row"
                  className="pr-2 text-right font-normal text-muted-foreground"
                >
                  {label}
                </th>
                {row.map((count, column) => (
                  <td
                    key={confusion.labels[column]}
                    className={
                      column === at
                        ? 'border border-border bg-accent px-2 py-1 text-center text-foreground'
                        : 'border border-border px-2 py-1 text-center text-muted-foreground'
                    }
                  >
                    {count}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
