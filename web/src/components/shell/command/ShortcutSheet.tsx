import { Search } from 'lucide-react';
import { useState } from 'react';

import { ShortcutKeys } from '@/components/shared/shortcut/ShortcutKeys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { shortcutSections } from '@/lib/commands/sheet';
import { desktopApp } from '@/lib/desktop';

type ShortcutSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ShortcutSheet({ open, onOpenChange }: ShortcutSheetProps) {
  const [query, setQuery] = useState('');
  const sections = shortcutSections(query, desktopApp() !== null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setQuery('');
        }
      }}
    >
      <DialogContent
        data-slot="shortcut-sheet"
        showCloseButton={false}
        className="top-[20%] flex max-h-[min(560px,70vh)] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Every keyboard shortcut in Spotlight
          </DialogDescription>
        </DialogHeader>

        <label className="flex h-11 shrink-0 items-center gap-2 border-border border-b-[0.5px] px-4 text-foreground text-sm">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search shortcuts"
            placeholder="Search shortcuts…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>

        <ScrollArea className="min-h-0 flex-1" contentClassName="px-3 py-3">
          {sections.length === 0 && (
            <p className="py-6 text-center text-muted-foreground text-sm">
              No shortcuts match.
            </p>
          )}

          {sections.map((section) => (
            <section
              key={section.heading}
              aria-label={section.heading}
              className="pt-4 first:pt-0"
            >
              <h3 className="pb-1 text-muted-foreground text-xs leading-6">
                {section.heading}
              </h3>
              <ul className="grid gap-x-6 sm:grid-cols-2">
                {section.rows.map((row) => (
                  <li
                    key={row.title}
                    data-slot="shortcut-row"
                    className="flex h-6 min-w-0 items-center justify-between gap-3 text-foreground text-sm"
                  >
                    <span className="truncate">{row.title}</span>
                    <ShortcutKeys keys={row.keys} filled size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
