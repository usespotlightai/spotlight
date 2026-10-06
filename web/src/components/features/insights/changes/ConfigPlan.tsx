import { PlanHeredoc } from '@/components/features/insights/changes/PlanHeredoc';
import { PlanLeafRow } from '@/components/features/insights/changes/PlanLeafRow';
import { PlanRow } from '@/components/features/insights/changes/PlanRow';
import { configPlan, leafNameWidth, planNameWidth } from '@/lib/config-plan';
import type { ConfigChange } from '@/lib/station-config';

export function ConfigPlan({ changes }: { changes: readonly ConfigChange[] }) {
  const entries = configPlan(changes);
  const width = planNameWidth(entries);

  return (
    <ul
      aria-label="What changed"
      data-slot="config-plan"
      className="min-w-0 font-mono text-foreground text-xs leading-5"
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
