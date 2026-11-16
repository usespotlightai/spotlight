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
        className="top-3 right-3 bottom-3 left-auto flex w-[calc(100%-1.5rem)] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[360px] data-open:slide-in-from-right-4 data-closed:slide-out-to-right-4 data-open:zoom-in-100 data-closed:zoom-out-100"
      >
        <DialogHeader className="gap-0 px-5 pt-5 pb-4">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            Every keyboard shortcut in Spotlight
          </DialogDescription>
        </DialogHeader>

        <label className="mx-5 mb-5 flex h-8 items-center gap-2 rounded-md border-[0.5px] border-border bg-background px-2.5 text-foreground text-sm focus-within:border-input">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search shortcuts"
            placeholder="Search shortcuts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>

        <ScrollArea className="min-h-0 flex-1" contentClassName="px-5 pb-5">
          {sections.length === 0 && (
            <p className="py-6 text-center text-muted-foreground text-sm">
              No shortcuts match.
            </p>
          )}

          {sections.map((section) => (
            <section
              key={section.heading}
              aria-label={section.heading}
              className="pt-6 first:pt-0"
            >
              <h3 className="pb-2 font-medium text-foreground text-sm leading-4">
                {section.heading}
              </h3>
              <ul>
                {section.rows.map((row) => (
                  <li
                    key={row.title}
                    data-slot="shortcut-row"
                    className="flex h-[33px] items-center justify-between gap-3 font-medium text-muted-foreground text-sm"
                  >
                    <span className="truncate">{row.title}</span>
                    <ShortcutKeys keys={row.keys} />
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
