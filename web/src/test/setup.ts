import '@testing-library/jest-dom/vitest';
import {
  ReadableStream,
  TransformStream,
  WritableStream,
} from 'node:stream/web';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

configure({ asyncUtilTimeout: 3000 });

globalThis.ReadableStream ??=
  ReadableStream as typeof globalThis.ReadableStream;
globalThis.WritableStream ??=
  WritableStream as typeof globalThis.WritableStream;
globalThis.TransformStream ??=
  TransformStream as typeof globalThis.TransformStream;

afterEach(cleanup);

Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
Element.prototype.scrollTo = () => undefined;
Element.prototype.getAnimations = () => [];
Range.prototype.getBoundingClientRect = () => new DOMRect();
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;

class NoResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= NoResizeObserver;

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

globalThis.IntersectionObserver ??= NoIntersectionObserver;
