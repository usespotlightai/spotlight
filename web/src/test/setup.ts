// Registers the jest-dom matchers (toBeInTheDocument, toHaveClass, ...) on
// vitest's expect, along with their type augmentation.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-registers cleanup when vitest `globals` is on.
// These tests import explicitly, so unmount is wired up by hand. Without it
// each render leaks into the next test's document.
afterEach(cleanup);

// jsdom implements neither pointer capture nor scrollIntoView, and Base UI's
// floating components call both. Without these a menu never opens, and the
// failure looks like a missed click instead of a missing API.
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

// jsdom lays nothing out, so it has no ResizeObserver. Components that watch
// their own size need one to exist, even if it never reports anything.
class NoResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= NoResizeObserver;
