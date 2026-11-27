import { useRef } from 'react';

type ColumnResizerProps = {
  label: string;
  onStart: () => void;
  onResize: (width: number) => void;
  onReset: () => void;
};

export function ColumnResizer({
  label,
  onStart,
  onResize,
  onReset,
}: ColumnResizerProps) {
  const start = useRef<{ x: number; width: number } | null>(null);

  return (
    <hr
      aria-hidden
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      onPointerDown={(event) => {
        const cell = event.currentTarget.parentElement;

        if (!cell) {
          return;
        }

        onStart();
        start.current = {
          x: event.clientX,
          width: cell.getBoundingClientRect().width,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (start.current) {
          onResize(start.current.width + event.clientX - start.current.x);
        }
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onLostPointerCapture={() => {
        start.current = null;
      }}
      onDoubleClick={onReset}
      className="absolute inset-y-0 left-full z-10 m-0 h-auto w-6 border-0 cursor-col-resize touch-none after:absolute after:inset-y-0.5 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border after:transition-colors hover:after:bg-faint active:after:bg-faint"
    />
  );
}
