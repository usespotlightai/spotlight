import { Logo } from '@/components/shared/icons';

export function FileNote({ note }: { note: string }) {
  return (
    <div className="border-border border-b-[0.5px] px-3 py-2">
      <section
        aria-label="What Spotlight says about this file"
        className="flex max-w-lg flex-col gap-3 rounded-lg border-[0.5px] border-border bg-card p-3 font-sans shadow-xs"
      >
        <div className="flex gap-2.5">
          <div className="flex h-5 shrink-0 items-center">
            <Logo className="size-5 rounded" aria-hidden />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex h-5 items-center gap-2 text-xs">
              <span className="font-medium text-foreground">Spotlight</span>
            </div>

            <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-5">
              {note}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
