export function MemoryCellLabel({ children }: { children: string }) {
  return (
    <span className="text-muted-foreground text-xs leading-4 @4xl/pane:hidden">
      {children}
    </span>
  );
}
