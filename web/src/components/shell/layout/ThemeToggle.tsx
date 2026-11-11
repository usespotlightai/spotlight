import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { type LucideIcon, Monitor, Moon, Sun } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { isTheme, type Theme } from '@/hooks/useTheme';

const OPTIONS: { value: Theme; label: string; Icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

type ThemeToggleProps = {
  theme: Theme;
  onChange: (theme: Theme) => void;
};

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const selectedIndex = OPTIONS.findIndex(({ value }) => value === theme);

  return (
    <div className="flex items-center justify-between gap-4 px-2 py-1 text-sm">
      <span id="theme-toggle-label">Theme</span>

      <RadioGroup
        aria-labelledby="theme-toggle-label"
        value={theme}
        onValueChange={(next) => {
          if (isTheme(next)) {
            onChange(next);
          }
        }}
        className="relative flex items-center gap-1 rounded-lg bg-border/50 p-0.5"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-0.5 left-0.5 size-6 rounded-md bg-card shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${selectedIndex * 1.75}rem)` }}
        />
        {OPTIONS.map(({ value, label, Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger
              render={
                <Radio.Root
                  value={value}
                  aria-label={label}
                  className="relative flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[checked]:text-foreground"
                />
              }
            >
              <Icon className="size-3.5" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </RadioGroup>
    </div>
  );
}
