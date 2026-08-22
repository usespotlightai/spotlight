// Registers the jest-dom matchers (toBeInTheDocument, toHaveClass, ...) on
// vitest's expect, along with their type augmentation.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-registers cleanup when vitest `globals` is on.
// We import explicitly instead, so unmount has to be wired up by hand —
// without it, each render leaks into the next test's document.
afterEach(cleanup);

// jsdom implements neither pointer capture nor scrollIntoView, and Base UI's
// floating components call both. Without these a menu never opens, and the
// failure looks like the click missed rather than like a missing API.
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
