import { ChevronDown } from 'lucide-react';
import { AgentEffortMenu } from '@/components/features/stations/AgentEffortMenu';
import { AgentHarnessMenu } from '@/components/features/stations/AgentHarnessMenu';
import { AgentModelMenu } from '@/components/features/stations/AgentModelMenu';
import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { agentName } from '@/lib/agent-choice';

type AgentPickerProps = {
  harness: string;
  model: string;
  effort: string;
  onHarness?: (harness: string) => void;
  onModel?: (model: string) => void;
  onEffort?: (effort: string) => void;
};

export function AgentPicker({
  harness,
  model,
  effort,
  onHarness,
  onModel,
  onEffort,
}: AgentPickerProps) {
  const { data: harnesses } = useHarnesses();
  const readOnly = !onHarness && !onModel && !onEffort;

  if (!harnesses) {
    return <SkeletonLine className="h-4 w-32" />;
  }

  const offered = harnesses.find((each) => each.id === harness);
  const named = agentName(offered, model, effort);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Agent: ${named}`}
        disabled={readOnly}
        className="flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-foreground text-sm outline-none transition-colors hover:bg-accent disabled:pointer-events-none data-[popup-open]:bg-accent"
      >
        <HarnessLogo harness={offered?.id} />
        <span className="truncate">{named}</span>
        {!readOnly && (
          <ChevronDown
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-56">
        <AgentEffortMenu
          efforts={offered?.efforts ?? []}
          effort={effort}
          onEffort={onEffort}
        />

        <AgentModelMenu
          models={offered?.models ?? []}
          model={model}
          onModel={onModel}
        />

        <AgentHarnessMenu
          harnesses={harnesses}
          harness={harness}
          onHarness={onHarness}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
