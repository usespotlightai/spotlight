import { type LucideIcon, X } from 'lucide-react';
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

  return (
    <li
      data-slot="app-tab"
      data-active={active || undefined}
      onAuxClick={(event) => {
        if (closable && event.button === MIDDLE_BUTTON) {
          onClose();
        }
      }}
      className={cn(
        'group/tab relative flex h-7 w-56 min-w-0 shrink items-center rounded-md text-sm transition-colors',
        active
          ? 'bg-card text-foreground shadow-control'
          : 'bg-card/50 text-muted-foreground hover:bg-card/80 hover:text-foreground',
      )}
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
