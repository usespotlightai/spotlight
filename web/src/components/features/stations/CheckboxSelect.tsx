import { ChevronsUpDown } from 'lucide-react';
import type { ComponentType } from 'react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  readOnly?: boolean;
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
  readOnly = false,
  className,
}: CheckboxSelectProps) {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        disabled={readOnly}
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
        {!readOnly && (
          <ChevronsUpDown
            className="ml-auto size-3 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-52">
        {options.length === 0 ? (
          <div className="px-2 py-1.5 text-muted-foreground text-sm">
            {empty}
          </div>
        ) : (
          options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={value.includes(option)}
              closeOnClick={false}
              onCheckedChange={(checked) => toggle(option, Boolean(checked))}
            >
              <span className="truncate">{option}</span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
