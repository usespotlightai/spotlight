import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Gallery,
  type GalleryEntry,
} from '@/components/shared/attachment/imageGalleryContext';
import { Button } from '@/components/ui/button';
import { prefersReducedMotion } from '@/lib/motion';
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

const SWAP = {
  duration: 120,
  easing: 'ease-out',
};

type Size = { width: number; height: number };

const fitted = (image: HTMLImageElement | null): Size => {
  const room = {
    width: window.innerWidth - MARGIN_X * 2,
    height: window.innerHeight - MARGIN_Y * 2,
  };

  if (!image?.naturalWidth || !image.naturalHeight) {
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

const play = (
  element: HTMLElement | null,
  keyframes: Keyframe[],
  timing: KeyframeAnimationOptions,
): Promise<unknown> =>
  element && 'animate' in element && !prefersReducedMotion()
    ? element
        .animate(keyframes, { ...timing, fill: 'forwards' })
        .finished.catch(() => undefined)
    : Promise.resolve();

const inDocumentOrder = (a: GalleryEntry, b: GalleryEntry) =>
  a.button.compareDocumentPosition(b.button) & Node.DOCUMENT_POSITION_FOLLOWING
    ? -1
    : 1;

const thumbOf = (entry: GalleryEntry) => entry.button.querySelector('img');

export function ImageGallery({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<readonly GalleryEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLImageElement | null>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const stage = useRef<{ button: HTMLButtonElement | null; opening: boolean }>({
    button: null,
    opening: false,
  });

  const sorted = useMemo(() => [...entries].sort(inDocumentOrder), [entries]);
  const index = sorted.findIndex((each) => each.id === openId);
  const current = sorted[index];
  const previous = sorted[index - 1];
  const next = sorted[index + 1];

  const register = useCallback((entry: GalleryEntry) => {
    setEntries((was) => [...was.filter((each) => each.id !== entry.id), entry]);
  }, []);

  const unregister = useCallback((id: string) => {
    setEntries((was) => was.filter((each) => each.id !== id));
    setOpenId((was) => (was === id ? null : was));
  }, []);

  const show = (entry: GalleryEntry, opening: boolean) => {
    closing.current = false;
    stage.current = { button: entry.button, opening };
    setSize(fitted(thumbOf(entry)));
    setOpenId(entry.id);
  };

  const open = (id: string) => {
    const entry = sorted.find((each) => each.id === id);

    if (entry) {
      show(entry, true);
    }
  };

  const go = (entry: GalleryEntry | undefined) => {
    if (entry && !closing.current) {
      popup.current?.focus();
      show(entry, false);
    }
  };

  const enter = (node: HTMLImageElement | null) => {
    view.current = node;
    const { button, opening } = stage.current;

    if (!node) {
      return;
    }

    if (opening && button) {
      void play(node, [atThumb(button, node), atView(node)], GROW);
      void play(backdrop.current, [{ opacity: 0 }, { opacity: 1 }], DIM);
    } else {
      void play(node, [{ opacity: 0 }, { opacity: 1 }], SWAP);
    }
  };

  const close = async () => {
    if (closing.current) {
      return;
    }

    closing.current = true;
    const { button } = stage.current;

    await Promise.all([
      button?.isConnected && view.current
        ? play(
            view.current,
            [atView(view.current), atThumb(button, view.current)],
            SHRINK,
          )
        : play(view.current, [{ opacity: 1 }, { opacity: 0 }], SHRINK),
      play(backdrop.current, [{ opacity: 1 }, { opacity: 0 }], SHRINK),
      play(closer.current, [{ opacity: 1 }, { opacity: 0 }], SHRINK),
    ]);

    setOpenId(null);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || sorted.length < 2) {
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      go(event.key === 'ArrowLeft' ? previous : next);
    }
  };

  const value = { openId, register, unregister, open };

  const several = sorted.length > 1;

  const step = (
    entry: GalleryEntry | undefined,
    label: string,
    side: string,
    Icon: typeof XIcon,
  ) => (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={!entry}
      onClick={(event) => {
        event.stopPropagation();
        go(entry);
      }}
      aria-label={label}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 text-white/80 hover:bg-white/10 hover:text-white dark:hover:bg-white/10',
        side,
      )}
    >
      <Icon aria-hidden />
    </Button>
  );

  return (
    <Gallery.Provider value={value}>
      {children}

      <DialogPrimitive.Root
        open={current !== undefined}
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
            ref={popup}
            aria-label={current?.name}
            finalFocus={() => stage.current.button}
            onKeyDown={onKeyDown}
            onClick={(event) => {
              event.stopPropagation();
              void close();
            }}
            className="fixed inset-0 z-50 flex items-center justify-center outline-none"
          >
            {current && size && (
              <div className="relative">
                <img
                  key={current.id}
                  ref={enter}
                  src={current.src}
                  alt={current.name}
                  width={size.width}
                  height={size.height}
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
                {several && (
                  <>
                    {step(
                      previous,
                      'Previous image',
                      'right-full mr-2',
                      ChevronLeftIcon,
                    )}
                    {step(
                      next,
                      'Next image',
                      'left-full ml-2',
                      ChevronRightIcon,
                    )}
                    <p className="absolute top-full mt-2 flex w-full justify-between gap-4 text-sm text-white/80">
                      <span className="truncate">{current.name}</span>
                      <span className="shrink-0">
                        {index + 1} / {sorted.length}
                      </span>
                    </p>
                  </>
                )}
              </div>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </Gallery.Provider>
  );
}
