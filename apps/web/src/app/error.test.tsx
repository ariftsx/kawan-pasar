import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RouteError from './error';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

describe('route error boundary', () => {
  it('re-fetches the server render before resetting, so a recovered API is used', () => {
    const reset = vi.fn();
    render(<RouteError error={new Error('upstream unavailable')} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('shows no error detail', () => {
    const { container } = render(
      <RouteError error={new Error('ECONNREFUSED api:3001')} reset={vi.fn()} />,
    );
    expect(container.textContent).not.toContain('ECONNREFUSED');
  });
});
