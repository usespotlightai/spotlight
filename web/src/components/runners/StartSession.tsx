import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import type { Runner } from '@/lib/runner';

type StartSessionProps = {
  runner: Runner;
  starting: boolean;
  onStart: (harness: string) => void;
};

/** With only one harness installed there is nothing to ask about. */
export function StartSession({ runner, starting, onStart }: StartSessionProps) {
  const { data: known } = useHarnesses();

  const installed = runner.harnesses.map(
    (id) => known?.find((harness) => harness.id === id) ?? { id, name: id },
  );

  if (installed.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        This runner reported no harnesses it can start.
      </p>
    );
  }

  if (installed.length === 1) {
    const only = installed[0] as { id: string; name: string };

    return (
      <Button
        variant="outline"
        size="sm"
        disabled={starting}
        onClick={() => onStart(only.id)}
      >
        {starting ? 'Starting…' : `Start ${only.name}`}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={starting}>
            {starting ? 'Starting…' : 'Start session'}
            <ChevronDown className="size-3.5" aria-hidden />
          </Button>
        }
      />

      <DropdownMenuContent align="center" sideOffset={6} className="min-w-44">
        {installed.map((harness) => (
          <DropdownMenuItem
            key={harness.id}
            onClick={() => onStart(harness.id)}
          >
            <span className="truncate">{harness.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
