import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WindowState {
  readonly bounds: Bounds;
  readonly maximized: boolean;
  readonly fullScreen: boolean;
}

export const DEFAULT_SIZE = { width: 1280, height: 800 };

export const MINIMUM_SIZE = { width: 800, height: 480 };

const VISIBLE_AT_LEAST = 100;

const overlap = (one: Bounds, other: Bounds) => ({
  width:
    Math.min(one.x + one.width, other.x + other.width) -
    Math.max(one.x, other.x),
  height:
    Math.min(one.y + one.height, other.y + other.height) -
    Math.max(one.y, other.y),
});

const isBounds = (value: unknown): value is Bounds =>
  typeof value === 'object' &&
  value !== null &&
  'x' in value &&
  'y' in value &&
  'width' in value &&
  'height' in value &&
  [value.x, value.y, value.width, value.height].every(
    (each) => typeof each === 'number' && Number.isFinite(each),
  );

export const restorable = (
  state: WindowState | null,
  workAreas: readonly Bounds[],
): WindowState | null => {
  if (
    !state ||
    state.bounds.width < MINIMUM_SIZE.width ||
    state.bounds.height < MINIMUM_SIZE.height
  ) {
    return null;
  }

  const shown = workAreas.some((area) => {
    const seen = overlap(state.bounds, area);

    return seen.width >= VISIBLE_AT_LEAST && seen.height >= VISIBLE_AT_LEAST;
  });

  return shown ? state : null;
};

export class WindowStateFile {
  private readonly path: string;

  constructor(directory: string) {
    this.path = join(directory, 'window.json');
  }

  read(): WindowState | null {
    try {
      const stored: unknown = JSON.parse(readFileSync(this.path, 'utf8'));

      if (
        typeof stored !== 'object' ||
        stored === null ||
        !('bounds' in stored) ||
        !isBounds(stored.bounds)
      ) {
        return null;
      }

      return {
        bounds: stored.bounds,
        maximized: 'maximized' in stored && stored.maximized === true,
        fullScreen: 'fullScreen' in stored && stored.fullScreen === true,
      };
    } catch {
      return null;
    }
  }

  write(state: WindowState): void {
    try {
      writeFileSync(this.path, JSON.stringify(state, null, 2));
    } catch {}
  }
}
