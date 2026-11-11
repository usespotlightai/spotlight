import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';
import { type MouseEvent, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MARGIN_X = 64;
const MARGIN_Y = 32;
const SHADOW_ROOM = 64;

const sampled = (
  progress: (ms: number) => number,
  duration: number,
  steps = 40,
): string => {
  const end = progress(duration);
  const points = Array.from({ length: steps + 1 }, (_, i) =>
    (progress((i / steps) * duration) / end).toFixed(4),
  );

  return `linear(${points.join(', ')})`;
};

const GROW = {
  duration: 300,
  easing: sampled(
    (ms) => 1 - 0.75 * Math.exp(-ms / 15) - 0.25 * Math.exp(-ms / 58),
    300,
  ),
};
const DIM = {
  duration: 380,
  delay: -20,
  easing: sampled((ms) => 1 - Math.exp(-ms / 68), 380),
};
const SHRINK = {
  duration: 70,
  easing: 'cubic-bezier(0.5, 0, 0.75, 0)',
};

type Size = { width: number; height: number };

const fitted = (image: HTMLImageElement): Size => {
  const room = {
    width: window.innerWidth - MARGIN_X * 2,
    height: window.innerHeight - MARGIN_Y * 2,
  };

  if (!image.naturalWidth || !image.naturalHeight) {
    return room;
  }

  const scale = Math.min(
    1,
    room.width / image.naturalWidth,
    room.height / image.naturalHeight,
  );

  return {
    width: Math.round(image.naturalWidth * scale),
    height: Math.round(image.naturalHeight * scale),
  };
};

const radius = (element: HTMLElement) =>
  Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;

const atThumb = (thumb: HTMLElement, view: HTMLElement): Keyframe => {
  const from = thumb.getBoundingClientRect();
  const to = view.getBoundingClientRect();
  const scale = Math.max(from.width / to.width, from.height / to.height);
  const x = from.left + from.width / 2 - (to.left + to.width / 2);
  const y = from.top + from.height / 2 - (to.top + to.height / 2);
  const insetX = (to.width - from.width / scale) / 2;
  const insetY = (to.height - from.height / scale) / 2;

  return {
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
    clipPath: `inset(${insetY}px ${insetX}px round ${radius(thumb) / scale}px)`,
  };
};

const atView = (view: HTMLElement): Keyframe => ({
  transform: 'translate(0px, 0px) scale(1)',
  clipPath: `inset(-${SHADOW_ROOM}px round ${radius(view) + SHADOW_ROOM}px)`,
});

const still = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const play = (
  element: HTMLElement | null,
  keyframes: Keyframe[],
  timing: KeyframeAnimationOptions,
): Promise<unknown> =>
  element && 'animate' in element && !still()
    ? element
        .animate(keyframes, { ...timing, fill: 'forwards' })
        .finished.catch(() => undefined)
    : Promise.resolve();

type ZoomableImageProps = {
  src: string;
  name: string;
  className?: string;
  loading?: HTMLImageElement['loading'];
  onError?: () => void;
};

export function ZoomableImage({
  src,
  name,
  className,
  loading,
  onError,
}: ZoomableImageProps) {
  const button = useRef<HTMLButtonElement>(null);
  const thumb = useRef<HTMLImageElement>(null);
  const view = useRef<HTMLImageElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const [shown, setShown] = useState<Size | null>(null);
  const closing = useRef(false);

  const open = (event: MouseEvent) => {
    event.stopPropagation();

    if (thumb.current) {
      closing.current = false;
      setShown(fitted(thumb.current));
    }
  };

  const grow = (node: HTMLImageElement | null) => {
    view.current = node;

    if (node && button.current) {
      void play(node, [atThumb(button.current, node), atView(node)], GROW);
      void play(backdrop.current, [{ opacity: 0 }, { opacity: 1 }], DIM);
    }
  };

  const close = async () => {
    if (closing.current) {
      return;
    }

    closing.current = true;

    await Promise.all([
      button.current?.isConnected && view.current
        ? play(
            view.current,
            [atView(view.current), atThumb(button.current, view.current)],
            SHRINK,
          )
        : play(view.current, [{ opacity: 1 }, { opacity: 0 }], SHRINK),
      play(backdrop.current, [{ opacity: 1 }, { opacity: 0 }], SHRINK),
      play(closer.current, [{ opacity: 1 }, { opacity: 0 }], SHRINK),
    ]);

    setShown(null);
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={open}
        aria-label={`View ${name}`}
        className={cn(
          'size-full cursor-zoom-in rounded-[inherit] outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          shown && 'bg-muted',
        )}
      >
        <img
          ref={thumb}
          src={src}
          alt=""
          loading={loading}
          onError={onError}
          className={cn(className, shown && 'invisible')}
        />
      </button>

      <DialogPrimitive.Root
        open={shown !== null}
        onOpenChange={(next) => {
          if (!next) {
            void close();
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            ref={backdrop}
            className="fixed inset-0 isolate z-50 bg-black/70 supports-backdrop-filter:backdrop-blur-xs"
          />
          <DialogPrimitive.Popup
            aria-label={name}
            finalFocus={button}
            onClick={(event) => {
              event.stopPropagation();
              void close();
            }}
            className="fixed inset-0 z-50 flex items-center justify-center outline-none"
          >
            {shown && (
              <div className="relative">
                <img
                  ref={grow}
                  src={src}
                  alt={name}
                  width={shown.width}
                  height={shown.height}
                  className="block rounded-xl object-contain shadow-overlay ring-1 ring-foreground/10"
                />
                <Button
                  ref={closer}
                  variant="ghost"
                  size="icon-sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    void close();
                  }}
                  aria-label="Close"
                  className="absolute top-0 left-full ml-2 text-white/80 hover:bg-white/10 hover:text-white dark:hover:bg-white/10"
                >
                  <XIcon aria-hidden />
                </Button>
              </div>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
