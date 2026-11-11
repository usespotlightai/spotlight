import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type LucideIcon, X } from 'lucide-react';

import { TAB_SLIDE, tabFrame } from '@/components/shell/tabs/app-tab-look';
import { type AppTab, NEW_TAB_TITLE } from '@/lib/app-tabs';
import { cn } from '@/lib/utils';

const MIDDLE_BUTTON = 1;

type AppTabItemProps = {
  tab: AppTab;
  icon: LucideIcon;
  active: boolean;
  closable: boolean;
  onSelect: () => void;
  onClose: () => void;
};

export function AppTabItem({
  tab,
  icon: Icon,
  active,
  closable,
  onSelect,
  onClose,
}: AppTabItemProps) {
  const title = tab.title ?? NEW_TAB_TITLE;
  const { setNodeRef, listeners, transform, transition, isDragging } =
    useSortable({ id: tab.id, transition: TAB_SLIDE });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      {...listeners}
      data-slot="app-tab"
      data-active={active || undefined}
      data-dragging={isDragging || undefined}
      onAuxClick={(event) => {
        if (closable && event.button === MIDDLE_BUTTON) {
          onClose();
        }
      }}
      className={cn(tabFrame(active), isDragging && 'opacity-0')}
    >
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={onSelect}
        className={cn(
          'flex h-full min-w-0 flex-1 items-center gap-2 rounded-md pl-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          closable ? 'pr-7' : 'pr-2.5',
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{title}</span>
      </button>

      {closable && (
        <button
          type="button"
          aria-label={`Close ${title}`}
          onClick={onClose}
          className="absolute right-1 flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-border hover:text-foreground focus-visible:opacity-100 group-hover/tab:opacity-100"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </li>
  );
}
