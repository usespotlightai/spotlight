import { ChevronDown } from 'lucide-react';
import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useHarnesses } from '@/hooks/api/useHarnesses';

const DEFAULT = '__default';

const capitalized = (word: string): string =>
  `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

const chosen = (next: unknown): string =>
  String(next) === DEFAULT ? '' : String(next);

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
  const models = offered?.models ?? [];
  const efforts = offered?.efforts ?? [];
  const modelName = models.find((each) => each.id === model)?.name;
  const shownEffort = efforts.length > 0 && effort ? capitalized(effort) : '';
  const named = [offered?.name ?? 'Nobody', modelName, shownEffort].filter(
    Boolean,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Agent: ${named.join(' ')}`}
        disabled={readOnly}
        className="flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-foreground text-sm outline-none transition-colors hover:bg-accent disabled:pointer-events-none data-[popup-open]:bg-accent"
      >
        <HarnessLogo harness={offered?.id} />
        <span className="truncate">{named.join(' ')}</span>
        {!readOnly && (
          <ChevronDown
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-56">
        {efforts.length > 0 && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className="flex-1">Effort</span>
                <span className="text-muted-foreground">
                  {effort ? capitalized(effort) : 'Default'}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent sideOffset={8} className="min-w-44">
                <DropdownMenuRadioGroup
                  value={effort || DEFAULT}
                  onValueChange={(next) => onEffort?.(chosen(next))}
                >
                  <DropdownMenuRadioItem value={DEFAULT}>
                    Default
                  </DropdownMenuRadioItem>
                  {efforts.map((each) => (
                    <DropdownMenuRadioItem key={each} value={each}>
                      {capitalized(each)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={models.length === 0}>
            <span className="flex-1">Model</span>
            <span className="truncate text-muted-foreground">
              {modelName ?? 'Default'}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={8} className="min-w-52">
            <DropdownMenuRadioGroup
              value={model || DEFAULT}
              onValueChange={(next) => onModel?.(chosen(next))}
            >
              <DropdownMenuRadioItem value={DEFAULT}>
                Default
              </DropdownMenuRadioItem>
              {models.map((each) => (
                <DropdownMenuRadioItem key={each.id} value={each.id}>
                  <span className="truncate">{each.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="flex-1">Harness</span>
            <span className="truncate text-muted-foreground">
              {offered?.name ?? 'Nobody'}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={8} className="min-w-52">
            <DropdownMenuRadioGroup
              value={harness}
              onValueChange={(next) => onHarness?.(String(next))}
            >
              {harnesses.map((each) => (
                <DropdownMenuRadioItem
                  key={each.id}
                  value={each.id}
                  disabled={!onHarness && each.id !== harness}
                >
                  <HarnessLogo harness={each.id} />
                  <span className="truncate">{each.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
