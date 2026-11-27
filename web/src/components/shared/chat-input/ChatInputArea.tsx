import type { ReactNode } from 'react';

import { nonEmpty } from '@/lib/non-empty';

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
      style={nonEmpty(area) ? { gridArea: area } : undefined}
      className={className}
    >
      {children}
    </div>
  );
}
