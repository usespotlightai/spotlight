import { Button } from '@/components/ui/button';

type SidebarToggleProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-pressed={!collapsed}
      onClick={onToggle}
      className="shrink-0 text-muted-foreground"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        aria-hidden
        className="size-4"
      >
        <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="2.75" />
        {collapsed ? (
          <line
            x1="4.75"
            y1="5.25"
            x2="4.75"
            y2="10.75"
            strokeLinecap="round"
          />
        ) : (
          <rect
            x="4"
            y="4.5"
            width="3.25"
            height="7"
            rx="1"
            fill="currentColor"
          />
        )}
      </svg>
    </Button>
  );
}
