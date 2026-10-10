import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTheme } from '../theme';
import { ThemeToggle } from './ThemeToggle';

/** Shows the theme charts would use, to check it follows the toggle. */
function ChartTheme() {
  return <output aria-label="chart theme">{useTheme()}</output>;
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = 'light';
  });

  it('switches the page and the charts between light and dark, and remembers the choice', async () => {
    render(
      <>
        <ThemeToggle />
        <ChartTheme />
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByLabelText('chart theme')).toHaveTextContent('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByLabelText('chart theme')).toHaveTextContent('light');
  });
});
