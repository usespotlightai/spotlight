import { useNavigate } from 'react-router';

import { ShortcutKeys } from '@/components/shared/shortcut/ShortcutKeys';
import { PaletteActionItem } from '@/components/shell/command/PaletteActionItem';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useActiveCommands } from '@/hooks/useActiveCommands';
import { useCommandSections } from '@/hooks/useCommandSections';
import { paletteActions, shortcutFor } from '@/lib/commands/palette';
import {
  commandKeywords,
  commandMatch,
  type PaletteSection,
} from '@/lib/commands/targets';
import type { Role } from '@/lib/role';
import type { Team } from '@/lib/team';

type CommandPaletteProps = {
  slug: string;
  workspace: {
    readonly role: Role;
    readonly teams: readonly Team[];
  };
  open: boolean;
  section?: PaletteSection;
  onOpenChange: (open: boolean) => void;
};

const PLACEHOLDERS: Record<PaletteSection, string> = {
  Lines: 'Open a line…',
  Stations: 'Open a station…',
  Tasks: 'Open a task…',
};

export function CommandPalette({
  slug,
  workspace,
  open,
  section,
  onOpenChange,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const sections = useCommandSections(slug, workspace, open);
  const commands = useActiveCommands();
  const actions = section ? [] : paletteActions(commands);
  const doing = actions.filter((action) => !action.navigates);
  const going = actions.filter((action) => action.navigates);
  const shown = sections.filter(
    (each) => each.targets.length > 0 && (!section || each.heading === section),
  );

  const close = () => onOpenChange(false);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Run a command, or go to a page, line, station or task"
    >
      <Command filter={commandMatch}>
        <CommandInput
          placeholder={
            section
              ? PLACEHOLDERS[section]
              : 'Search commands, pages, lines, stations and tasks…'
          }
        />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>

          {doing.length > 0 && (
            <CommandGroup heading="Actions">
              {doing.map((action) => (
                <PaletteActionItem
                  key={action.id}
                  action={action}
                  onRun={close}
                />
              ))}
            </CommandGroup>
          )}

          {shown.map((each) => (
            <CommandGroup key={each.heading} heading={each.heading}>
              {each.targets.map((target) => {
                const shortcut = shortcutFor(commands, target.to);

                return (
                  <CommandItem
                    key={target.id}
                    value={target.id}
                    keywords={commandKeywords(target)}
                    onSelect={() => {
                      close();
                      void navigate(target.to);
                    }}
                  >
                    <target.icon />
                    <span className="truncate">{target.label}</span>
                    {(target.context || shortcut) && (
                      <span className="ml-auto flex shrink-0 items-center gap-3">
                        {target.context && (
                          <span className="text-muted-foreground text-xs">
                            {target.context}
                          </span>
                        )}
                        {shortcut && <ShortcutKeys id={shortcut} />}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
              {each.heading === 'Navigation' &&
                going.map((action) => (
                  <PaletteActionItem
                    key={action.id}
                    action={action}
                    onRun={close}
                  />
                ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
