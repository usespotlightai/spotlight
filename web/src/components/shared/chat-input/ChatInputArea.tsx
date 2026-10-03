import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const GREYED =
  'pointer-events-none opacity-50 [&_.truncate]:text-foreground! [&_button]:text-foreground! [&_svg]:text-foreground!';

type ChatInputAreaProps = {
  disabled: boolean;
  area?: string;
  className?: string;
  children: ReactNode;
};

export function ChatInputArea({
  disabled,
  area,
  className,
  children,
}: ChatInputAreaProps) {
  return (
    <div
      inert={disabled}
      style={area ? { gridArea: area } : undefined}
      className={cn(className, disabled && GREYED)}
    >
      {children}
    </div>
  );
}
