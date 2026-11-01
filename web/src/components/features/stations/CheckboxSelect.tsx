import { ChevronsUpDown } from 'lucide-react';
import { type ComponentType, useId } from 'react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type CheckboxSelectProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  options: readonly string[];
  value: readonly string[];
  onChange: (chosen: string[]) => void;
  none: string;
  many: (count: number) => string;
  empty: string;
  readOnlyBecause?: string;
  className?: string;
};

export function CheckboxSelect({
  label,
  icon: Icon,
  options,
  value,
  onChange,
  none,
  many,
  empty,
  readOnlyBecause,
  className,
}: CheckboxSelectProps) {
  const chosen = new Set(value);
  const readOnly = Boolean(readOnlyBecause);
  const reasonId = useId();

  const toggle = (option: string, checked: boolean) =>
    onChange(
      checked ? [...value, option] : value.filter((each) => each !== option),
    );

  const shown =
    value.length === 0
      ? none
      : value.length === 1
        ? (value[0] as string)
        : many(value.length);

  const listed = readOnly ? [...value].sort() : options;

  const items =
    listed.length === 0 ? (
      <div className="px-2 py-1.5 text-muted-foreground text-sm">
        {readOnly ? none : empty}
      </div>
    ) : (
      listed.map((option) => (
        <DropdownMenuCheckboxItem
          key={option}
          checked={chosen.has(option)}
          closeOnClick={false}
          disabled={readOnly}
          className="data-checked:data-disabled:opacity-100"
          onCheckedChange={(checked) => toggle(option, Boolean(checked))}
        >
          <span className="truncate">{option}</span>
        </DropdownMenuCheckboxItem>
      ))
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        aria-describedby={readOnly ? reasonId : undefined}
        className={cn(
          'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent',
          className,
        )}
      >
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span
          className={cn(
            'truncate',
            value.length > 0 ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {shown}
        </span>
        <ChevronsUpDown
          className="ml-auto size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>
      {readOnly && (
        <span id={reasonId} className="sr-only">
          {readOnlyBecause}
        </span>
      )}

      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-max min-w-[max(var(--anchor-width),13rem)] max-w-(--available-width)"
      >
        {readOnly ? (
          <Tooltip>
            <TooltipTrigger render={<div />}>{items}</TooltipTrigger>
            <TooltipContent side="right" align="start" sideOffset={10}>
              {readOnlyBecause}
            </TooltipContent>
          </Tooltip>
        ) : (
          items
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
