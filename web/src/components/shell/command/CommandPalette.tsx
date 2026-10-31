import { useNavigate } from 'react-router';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useCommandSections } from '@/hooks/useCommandSections';
import { commandKeywords, commandMatch } from '@/lib/command';
import type { Role } from '@/lib/role';
import type { Team } from '@/lib/team';

type CommandPaletteProps = {
  slug: string;
  workspace: {
    readonly role: Role;
    readonly teams: readonly Team[];
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({
  slug,
  workspace,
  open,
  onOpenChange,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const sections = useCommandSections(slug, workspace, open);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Go to a page, line, station or task"
    >
      <Command filter={commandMatch}>
        <CommandInput placeholder="Search pages, lines, stations and tasks…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {sections
            .filter((section) => section.targets.length > 0)
            .map((section) => (
              <CommandGroup key={section.heading} heading={section.heading}>
                {section.targets.map((target) => (
                  <CommandItem
                    key={target.id}
                    value={target.id}
                    keywords={commandKeywords(target)}
                    onSelect={() => {
                      onOpenChange(false);
                      void navigate(target.to);
                    }}
                  >
                    <target.icon />
                    <span className="truncate">{target.label}</span>
                    {target.context && (
                      <span className="ml-auto shrink-0 text-muted-foreground text-xs">
                        {target.context}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
