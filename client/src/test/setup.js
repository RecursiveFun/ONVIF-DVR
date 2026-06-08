import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Element.prototype.scrollIntoView = vi.fn();

if (typeof ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
}

if (!window.matchMedia) {
  window.matchMedia = vi.fn((query) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
