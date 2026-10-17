import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import type { PullRequestType } from '@/lib/insights-pull-requests';
import {
  advance,
  type Dot,
  type FlowGeometry,
  halfAt,
  spreadDots,
  TYPE_COLORS,
  type TypeShare,
} from '@/lib/pipeline-flow';

const FADED = 0.12;
const SHOWN = 0.9;
const LONGEST_STEP_S = 0.1;

type Particles = {
  canvas: RefObject<HTMLCanvasElement | null>;
  geometry: FlowGeometry;
  middle: number;
  height: number;
  shares: readonly TypeShare[];
  focus: PullRequestType | null;
  playing: boolean;
};

const resolved = (host: HTMLElement): Record<PullRequestType, string> => {
  const probe = document.createElement('span');
  host.appendChild(probe);

  const colors = Object.fromEntries(
    Object.entries(TYPE_COLORS).map(([type, color]) => {
      probe.style.color = color;
      return [type, getComputedStyle(probe).color];
    }),
  ) as Record<PullRequestType, string>;

  probe.remove();
  return colors;
};

export function usePipelineParticles({
  canvas,
  geometry,
  middle,
  height,
  shares,
  focus,
  playing,
}: Particles) {
  const width = geometry.width;
  const stages = geometry.centers.length;
  const dots = useRef<Dot[]>([]);
  const colors = useRef<Record<PullRequestType, string> | null>(null);
  const latest = useRef({ geometry, middle, shares, focus });
  const draw = useRef(() => {});

  const paint = () => {
    const element = canvas.current;
    const context = element?.getContext('2d');

    if (!element || !context) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    const width = latest.current.geometry.width;

    if (element.width !== Math.round(width * ratio)) {
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
    }

    colors.current ??= resolved(element.parentElement ?? document.body);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const { focus: picked, middle: across } = latest.current;

    for (const dot of dots.current) {
      context.globalAlpha = picked && dot.type !== picked ? FADED : SHOWN;
      context.fillStyle = colors.current[dot.type];
      context.beginPath();
      context.arc(
        dot.x,
        across + dot.lane * halfAt(latest.current.geometry, dot.x) * 0.85,
        dot.radius,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  };

  useLayoutEffect(() => {
    latest.current = { geometry, middle, shares, focus };
    draw.current = paint;
  });

  useEffect(() => {
    if (width > 0 && stages > 0) {
      dots.current = spreadDots(latest.current.geometry, shares);
    }
    draw.current();
  }, [width, stages, shares]);

  useEffect(() => {
    draw.current();
  });

  useEffect(() => {
    const element = canvas.current;

    if (!element) {
      return;
    }

    const repaint = () => {
      colors.current = null;
      draw.current();
    };
    const observer = new MutationObserver(repaint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', repaint);

    return () => {
      observer.disconnect();
      scheme.removeEventListener('change', repaint);
    };
  }, [canvas]);

  useEffect(() => {
    const element = canvas.current;

    if (!playing || !element) {
      return;
    }

    let frame = 0;
    let last: number | null = null;
    let visible = true;

    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    seen.observe(element);

    const tick = (now: number) => {
      const step =
        last === null ? 0 : Math.min(LONGEST_STEP_S, (now - last) / 1000);
      last = now;

      if (visible) {
        const { geometry: shape, shares: mix } = latest.current;
        advance(dots.current, shape, mix, step);
        draw.current();
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
    };
  }, [playing, canvas]);
}
