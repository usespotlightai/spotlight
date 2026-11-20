import type { ReactNode } from 'react';

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
      className={className}
    >
      {children}
    </div>
  );
}
