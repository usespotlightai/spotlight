import { ShortcutKeys } from '@/components/shared/shortcut/ShortcutKeys';
import { CommandItem } from '@/components/ui/command';
import type { PaletteAction } from '@/lib/commands/palette';

type PaletteActionItemProps = {
  action: PaletteAction;
  onRun: () => void;
};

export function PaletteActionItem({ action, onRun }: PaletteActionItemProps) {
  return (
    <CommandItem
      value={`command:${action.id}`}
      keywords={[action.title]}
      onSelect={() => {
        onRun();
        setTimeout(action.run);
      }}
    >
      <action.icon />
      <span className="truncate">{action.title}</span>
      <ShortcutKeys id={action.id} className="ml-auto" />
    </CommandItem>
  );
}
