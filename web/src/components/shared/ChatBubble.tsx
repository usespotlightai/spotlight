import type { ReactNode } from 'react';

export function ChatBubble({ children }: { children: ReactNode }) {
  return (
    <p className="w-fit max-w-[75%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-muted px-3 py-1.5 text-foreground text-sm leading-5">
      {children}
    </p>
  );
}
