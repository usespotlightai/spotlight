import { ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ConnectionToolRuleResponseDto } from '@/lib/api';

type Rule = ConnectionToolRuleResponseDto['rule'];

const RULES = [
  {
    value: 'allowed',
    label: 'Team’s rule',
    says: 'Runs as the team says',
  },
  {
    value: 'needs-approval',
    label: 'Ask me first',
    says: 'Waits for you to approve each call',
  },
  { value: 'blocked', label: 'Blocked', says: 'Never runs as you' },
] as const;

type ToolRuleSelectProps = {
  tool: string;
  rule: Rule;
  disabled: boolean;
  onRule: (rule: Rule) => void;
};

export function ToolRuleSelect({
  tool,
  rule,
  disabled,
  onRule,
}: ToolRuleSelectProps) {
  const shown = RULES.find((each) => each.value === rule) ?? RULES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Rule for ${tool}`}
        disabled={disabled}
        className="flex h-7 items-center gap-2 rounded-md px-2 text-foreground text-sm outline-none transition-colors hover:bg-accent disabled:opacity-50 data-[popup-open]:bg-accent"
      >
        {shown.label}
        <ChevronsUpDown
          className="size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="min-w-56">
        <DropdownMenuRadioGroup
          value={shown.value}
          onValueChange={(next) => {
            const picked = RULES.find((each) => each.value === next);

            if (picked) {
              onRule(picked.value);
            }
          }}
        >
          {RULES.map((each) => (
            <DropdownMenuRadioItem key={each.value} value={each.value}>
              <span className="flex flex-col">
                <span>{each.label}</span>
                <span className="text-muted-foreground text-xs">
                  {each.says}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
