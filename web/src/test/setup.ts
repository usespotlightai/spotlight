import '@testing-library/jest-dom/vitest';
import {
  ReadableStream,
  TransformStream,
  WritableStream,
} from 'node:stream/web';

import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

import { partial } from '@/test/partial';

configure({ asyncUtilTimeout: 3000 });

const fillIn = (globals: Record<string, unknown>): void => {
  for (const [name, value] of Object.entries(globals)) {
    const current: unknown = Reflect.get(globalThis, name);
    if (current === undefined || current === null) {
      Reflect.set(globalThis, name, value);
    }
  }
};

fillIn({ ReadableStream, WritableStream, TransformStream });

afterEach(cleanup);

Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
Element.prototype.scrollTo = () => undefined;
Element.prototype.getAnimations = () => [];
Range.prototype.getBoundingClientRect = () => new DOMRect();
Range.prototype.getClientRects = () => partial<DOMRectList>([]);
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;

class NoResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

fillIn({ ResizeObserver: NoResizeObserver });

class NoIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

fillIn({ IntersectionObserver: NoIntersectionObserver });
