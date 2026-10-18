import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

type Running = {
  readonly animations: readonly Animation[];
  end: (() => void) | null;
};

type LayoutTransition = {
  readonly play: (animations: readonly Animation[], end?: () => void) => void;
  readonly reverse: (end?: () => void) => boolean;
};

const cancel = (animations: readonly Animation[]) => {
  for (const animation of animations) {
    animation.cancel();
  }
};

export function useLayoutTransition(): LayoutTransition {
  const running = useRef<Running | null>(null);
  const finished = useRef<readonly Animation[]>([]);

  useLayoutEffect(() => {
    cancel(finished.current);
    finished.current = [];
  });

  useEffect(
    () => () => {
      cancel(running.current?.animations ?? []);
      cancel(finished.current);
    },
    [],
  );

  return useMemo(
    () => ({
      play: (animations, end) => {
        const [first] = animations;

        if (!first) {
          end?.();
          return;
        }

        const playing: Running = { animations, end: end ?? null };
        running.current = playing;
        first.onfinish = () => {
          if (running.current !== playing) {
            return;
          }
          running.current = null;

          if (!playing.end) {
            cancel(animations);
            return;
          }
          finished.current = [...finished.current, ...animations];
          playing.end();
        };
      },
      reverse: (end) => {
        const playing = running.current;

        if (!playing) {
          return false;
        }
        playing.end = end ?? null;

        for (const animation of playing.animations) {
          animation.reverse();
        }

        return true;
      },
    }),
    [],
  );
}
