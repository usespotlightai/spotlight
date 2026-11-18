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

const MARGIN_X = 64;
const MARGIN_Y = 32;
const SHADOW_ROOM = 64;
const MAX_SCALE = 2;
const PEEK_SCALE = 0.6;
const PEEK_VISIBLE = 24;
const CLOSER_ROOM = 44;

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

const OVERLAY_BUTTON =
  'text-white/80 hover:bg-white/10 hover:text-white dark:hover:bg-white/10';

const SWAP = {
  duration: 120,
  easing: 'ease-out',
};

type Size = { width: number; height: number };

const fitted = (image: HTMLImageElement | null, factor = 1): Size => {
  const room = {
    width: window.innerWidth - MARGIN_X * 2,
    height: window.innerHeight - MARGIN_Y * 2,
  };

  if (!image?.naturalWidth || !image.naturalHeight) {
    return room;
  }

  const scale =
    factor *
    Math.min(
      MAX_SCALE,
      room.width / image.naturalWidth,
      room.height / image.naturalHeight,
    );

  return {
    width: Math.round(image.naturalWidth * scale),
    height: Math.round(image.naturalHeight * scale),
  };
};

function Peek({
  entry,
  side,
  onClick,
}: {
  entry: GalleryEntry;
  side: 'previous' | 'next';
  onClick: () => void;
}) {
  const { width, height } = fitted(thumbOf(entry), PEEK_SCALE);

  return (
    <img
      data-peek={side}
      src={entry.src}
      alt=""
      aria-hidden
      width={width}
      height={height}
      style={{ [side === 'previous' ? 'left' : 'right']: PEEK_VISIBLE - width }}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="pointer-events-auto absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-xl object-contain opacity-40"
    />
  );
}

const thumbOf = (entry: GalleryEntry) => entry.button.querySelector('img');

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

export function ImageGallery({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<readonly GalleryEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLImageElement | null>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const pager = useRef<HTMLDivElement>(null);
  const peeks = useRef<HTMLDivElement>(null);
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
      void play(pager.current, [{ opacity: 0 }, { opacity: 1 }], DIM);
      void play(peeks.current, [{ opacity: 0 }, { opacity: 1 }], DIM);
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
      play(pager.current, [{ opacity: 1 }, { opacity: 0 }], SHRINK),
      play(peeks.current, [{ opacity: 1 }, { opacity: 0 }], SHRINK),
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

  const peeking =
    size !== null &&
    (window.innerWidth - size.width) / 2 >= PEEK_VISIBLE + CLOSER_ROOM;

  const value = { openId, register, unregister, open };

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
              <>
                {sorted.length > 1 && (
                  <div
                    ref={pager}
                    className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1"
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={!previous}
                      onClick={(event) => {
                        event.stopPropagation();
                        go(previous);
                      }}
                      aria-label="Previous image"
                      className={OVERLAY_BUTTON}
                    >
                      <ChevronLeftIcon aria-hidden />
                    </Button>
                    <span
                      aria-live="polite"
                      className="text-sm text-white/80 tabular-nums"
                    >
                      {index + 1} of {sorted.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={!next}
                      onClick={(event) => {
                        event.stopPropagation();
                        go(next);
                      }}
                      aria-label="Next image"
                      className={OVERLAY_BUTTON}
                    >
                      <ChevronRightIcon aria-hidden />
                    </Button>
                  </div>
                )}
                {sorted.length > 1 && peeking && (
                  <div
                    ref={peeks}
                    className="pointer-events-none fixed inset-0 overflow-hidden"
                  >
                    {previous && (
                      <Peek
                        entry={previous}
                        side="previous"
                        onClick={() => go(previous)}
                      />
                    )}
                    {next && (
                      <Peek entry={next} side="next" onClick={() => go(next)} />
                    )}
                  </div>
                )}
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
                    className={`absolute top-0 left-full ml-2 ${OVERLAY_BUTTON}`}
                  >
                    <XIcon aria-hidden />
                  </Button>
                </div>
              </>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </Gallery.Provider>
  );
}
