import { ChevronsUpDown, CodeXml } from 'lucide-react';
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
import { cn } from '@/lib/utils';

const DEFAULT = 'default';

type ModelEffortSelectProps = {
  harness: string;
  model: string;
  onModel: (model: string) => void;
  effort: string;
  onEffort: (effort: string) => void;
  readOnly?: boolean;
  iconless?: boolean;
  className?: string;
};

const chosen = (next: unknown) =>
  String(next) === DEFAULT ? '' : String(next);

export function ModelEffortSelect({
  harness,
  model,
  onModel,
  effort,
  onEffort,
  readOnly = false,
  iconless = false,
  className,
}: ModelEffortSelectProps) {
  const { data: harnesses } = useHarnesses();

  const offered = harnesses?.find((each) => each.id === harness);
  const models = offered?.models ?? [];
  const efforts = offered?.efforts ?? [];
  const modelName =
    models.find((each) => each.id === model)?.name ?? 'Default model';
  const chosenEffort = efforts.length > 0 ? effort : '';
  const allDefault = !model && !chosenEffort;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Model and effort"
        disabled={readOnly || (models.length === 0 && efforts.length === 0)}
        className={cn(
          'flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent disabled:pointer-events-none disabled:opacity-50',
          readOnly && 'disabled:opacity-100',
          className,
        )}
      >
        {!iconless && (
          <CodeXml
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
        {allDefault ? (
          <span className="truncate text-muted-foreground">Default</span>
        ) : (
          <span
            className={cn(
              'truncate',
              model ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {modelName}
          </span>
        )}
        {!allDefault && efforts.length > 0 && (
          <span
            className={cn(
              'shrink-0',
              effort ? 'text-foreground capitalize' : 'text-muted-foreground',
            )}
          >
            {effort || 'Default'}
          </span>
        )}
        {!readOnly && (
          <ChevronsUpDown
            className="ml-auto size-3 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-56">
        {efforts.length > 0 && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className="flex-1">Effort</span>
                <span className="text-muted-foreground capitalize">
                  {effort || 'Default'}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent sideOffset={8} className="min-w-40">
                <DropdownMenuRadioGroup
                  value={effort || DEFAULT}
                  onValueChange={(next) => onEffort(chosen(next))}
                >
                  <DropdownMenuRadioItem value={DEFAULT}>
                    <span className="text-muted-foreground">Default</span>
                  </DropdownMenuRadioItem>
                  {efforts.map((each) => (
                    <DropdownMenuRadioItem key={each} value={each}>
                      <span className="capitalize">{each}</span>
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
            <span className="truncate text-muted-foreground">{modelName}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={8} className="min-w-52">
            <DropdownMenuRadioGroup
              value={model || DEFAULT}
              onValueChange={(next) => onModel(chosen(next))}
            >
              <DropdownMenuRadioItem value={DEFAULT}>
                <span className="text-muted-foreground">Default</span>
              </DropdownMenuRadioItem>
              {models.map((each) => (
                <DropdownMenuRadioItem key={each.id} value={each.id}>
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
