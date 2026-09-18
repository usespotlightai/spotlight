import { Outlet } from 'react-router';

export function StoryFrame() {
  return (
    <div className="flex h-svh bg-background p-2">
      <section className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border-[0.5px] border-border bg-surface shadow-pane">
        <Outlet />
      </section>
    </div>
  );
}
