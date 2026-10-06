import { PlanRow } from '@/components/features/insights/changes/PlanRow';
import type { PlanEntry } from '@/lib/config-plan';

type PlanHeredocProps = {
  entry: Extract<PlanEntry, { kind: 'text' }>;
  width: number;
};

const lines = (count: number): string =>
  `${count} ${count === 1 ? 'line' : 'lines'}`;

export function PlanHeredoc({ entry, width }: PlanHeredocProps) {
  return (
    <li>
      <ul>
        <PlanRow mark={entry.mark}>
          {`${entry.name.padEnd(width)} = <<-EOT`}
        </PlanRow>
        {entry.lines.map((line, at) =>
          'hidden' in line ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines keep their order
            <PlanRow key={at} depth={1}>
              <span className="text-muted-foreground">
                # ({lines(line.hidden)} unchanged hidden)
              </span>
            </PlanRow>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines keep their order
            <PlanRow key={at} mark={line.mark} depth={1} toned>
              {line.text || ' '}
            </PlanRow>
          ),
        )}
        <PlanRow>EOT</PlanRow>
      </ul>
    </li>
  );
}
