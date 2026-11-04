import {
  type DragEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react';
import { FileDropContext, type TakeFiles } from '@/hooks/useFileDropTarget';
import { carriesFiles, filesIn } from '@/lib/attachment';
import { cn } from '@/lib/utils';

type FileDropZoneProps = {
  children: ReactNode;
  className?: string;
};

export function FileDropZone({ children, className }: FileDropZoneProps) {
  const [take, setTake] = useState<TakeFiles | null>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const register = useCallback(
    (next: TakeFiles | null) => setTake(() => next),
    [],
  );

  const droppable = (event: DragEvent) =>
    take !== null && carriesFiles(event.dataTransfer);

  const leave = () => {
    depth.current = 0;
    setOver(false);
  };

  return (
    <FileDropContext value={register}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the attach button is the keyboard path; this only widens the drop target */}
      <div
        className={cn('relative', className)}
        onDragEnter={(event) => {
          if (!droppable(event)) {
            return;
          }
          depth.current += 1;
          setOver(true);
        }}
        onDragLeave={(event) => {
          if (!droppable(event)) {
            return;
          }
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) {
            setOver(false);
          }
        }}
        onDragOver={(event) => {
          if (!droppable(event)) {
            return;
          }
          event.preventDefault();
          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDropCapture={leave}
        onDrop={(event) => {
          if (!take || !droppable(event)) {
            return;
          }
          event.preventDefault();
          const files = filesIn(event.dataTransfer);
          if (files.length > 0) {
            take(files);
          }
        }}
      >
        {children}
        {over && <DropIndicator />}
      </div>
    </FileDropContext>
  );
}

function DropIndicator() {
  return (
    <div
      aria-hidden
      data-slot="file-drop-indicator"
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center duration-100 animate-in fade-in-0 motion-reduce:animate-none"
    >
      <span className="absolute inset-1.5 rounded-md bg-black/10 ring-2 ring-primary dark:bg-black/30" />
      <span className="relative whitespace-nowrap rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-md">
        Drop files here
      </span>
    </div>
  );
}
