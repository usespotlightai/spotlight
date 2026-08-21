// Registers the jest-dom matchers (toBeInTheDocument, toHaveClass, ...) on
// vitest's expect, along with their type augmentation.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-registers cleanup when vitest `globals` is on.
// We import explicitly instead, so unmount has to be wired up by hand —
// without it, each render leaks into the next test's document.
afterEach(cleanup);
