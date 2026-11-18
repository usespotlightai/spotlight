import { PlanHeredoc } from '@/components/features/insights/changes/PlanHeredoc';
import { PlanLeafRow } from '@/components/features/insights/changes/PlanLeafRow';
import { PlanRow } from '@/components/features/insights/changes/PlanRow';
import {
  leafNameWidth,
  type PlanEntry,
  planNameWidth,
} from '@/lib/config-plan';

export function ConfigPlan({ entries }: { entries: readonly PlanEntry[] }) {
  const width = planNameWidth(entries);

  return (
    <ul
      aria-label="What changed"
      data-slot="config-plan"
      className="min-w-0 font-mono text-xs text-foreground leading-4"
    >
      {entries.map((entry) => {
        if (entry.kind === 'leaf') {
          return <PlanLeafRow key={entry.id} leaf={entry} width={width} />;
        }

        if (entry.kind === 'text') {
          return <PlanHeredoc key={entry.id} entry={entry} width={width} />;
        }

        return (
          <li key={entry.id}>
            <ul>
              <PlanRow mark="changed">
                {entry.list
                  ? `${entry.name.padEnd(width)} = [`
                  : `${entry.name} {`}
              </PlanRow>
              {entry.leaves.map((leaf) => (
                <PlanLeafRow
                  key={leaf.id}
                  leaf={leaf}
                  width={leafNameWidth(entry.leaves)}
                  depth={1}
                />
              ))}
              <PlanRow>{entry.list ? ']' : '}'}</PlanRow>
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
