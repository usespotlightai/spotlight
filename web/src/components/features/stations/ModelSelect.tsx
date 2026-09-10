import { ChevronsUpDown, CodeXml } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { cn } from '@/lib/utils';

const NONE = 'none';

type ModelSelectProps = {
  /** The harness whose models are on offer. */
  harness: string;
  value: string;
  onChange: (model: string) => void;
};

/** "Default" leaves the harness to answer with its own model; disabled where
 *  a runner reported none. */
export function ModelSelect({ harness, value, onChange }: ModelSelectProps) {
  const { data: harnesses } = useHarnesses();

  const models = harnesses?.find((each) => each.id === harness)?.models ?? [];
  const chosen = models.find((model) => model.id === value);
  const none = models.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Model"
        disabled={none}
        className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        <CodeXml
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span
          className={cn(
            'truncate',
            chosen ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {chosen?.name ?? 'Default model'}
        </span>
        <ChevronsUpDown
          className="ml-auto size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-52">
        <DropdownMenuRadioGroup
          value={value || NONE}
          onValueChange={(next) =>
            onChange(String(next) === NONE ? '' : String(next))
          }
        >
          <DropdownMenuRadioItem value={NONE}>
            <span className="truncate text-muted-foreground">Default</span>
          </DropdownMenuRadioItem>

          {models.map((model) => (
            <DropdownMenuRadioItem key={model.id} value={model.id}>
              <span className="truncate">{model.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
