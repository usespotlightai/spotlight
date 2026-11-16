import { ShortcutHint } from '@/components/shared/shortcut/ShortcutHint';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCommands } from '@/hooks/useCommands';
import type { MenuAction } from '@/lib/context-menu';

type ResolveToggleProps = {
  action: MenuAction;
};

export function ResolveToggle({
  action: { label, icon: Icon, onSelect, disabled },
}: ResolveToggleProps) {
  useCommands([
    {
      id: 'inbox.resolve',
      title: label,
      run: onSelect,
      enabled: () => !disabled,
    },
  ]);

  return (
    <Tooltip>
      <TooltipTrigger
        // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the trigger renders this button around its children
        render={<button type="button" />}
        aria-label={label}
        disabled={disabled}
        onClick={onSelect}
        className="-my-0.5 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-[color,opacity] hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 group-hover/row:opacity-100 group-has-[a:focus-visible]/row:opacity-100 pointer-coarse:size-9 pointer-coarse:opacity-100"
      >
        <Icon aria-hidden className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>
        <ShortcutHint id="inbox.resolve">{label}</ShortcutHint>
      </TooltipContent>
    </Tooltip>
  );
}
