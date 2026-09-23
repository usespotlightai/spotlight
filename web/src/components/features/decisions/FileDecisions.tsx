import { DecisionThread } from '@/components/features/decisions/DecisionThread';
import { useDeciding } from '@/lib/decisions-context';

export function FileDecisions({ path }: { path: string }) {
  const deciding = useDeciding();
  const decisions =
    deciding?.found.decisions.filter((each) => each.paths.includes(path)) ?? [];

  if (!deciding || decisions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 border-border border-b-[0.5px] px-3 py-2">
      {decisions.map((decision) => (
        <DecisionThread
          key={decision.id}
          decision={decision}
          path={path}
          reasoningAt={deciding.reasoningAt}
          disputing={deciding.disputing}
        />
      ))}
    </div>
  );
}
