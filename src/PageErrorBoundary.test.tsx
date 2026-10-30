// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import PageErrorBoundary from './PageErrorBoundary';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('shows a recovery action instead of removing the page after a render failure', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const Broken = (): never => { throw new Error('Failed to fetch dynamically imported module'); };
  render(<PageErrorBoundary><Broken /></PageErrorBoundary>);
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Actualizar página' })).toBeTruthy();
});
