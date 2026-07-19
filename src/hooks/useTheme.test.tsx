import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from './useTheme';

const initialState = useAppStore.getState();

function Harness() {
  useTheme();
  return null;
}

function mockMatchMedia(prefersLight: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('light') ? prefersLight : !prefersLight,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  useAppStore.setState(initialState, true);
  document.documentElement.removeAttribute('data-theme');
  mockMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTheme', () => {
  test('forces the light attribute when theme is light', () => {
    useAppStore.setState({ settings: { ...initialState.settings, theme: 'light' } });
    render(<Harness />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('forces the dark attribute when theme is dark', () => {
    useAppStore.setState({ settings: { ...initialState.settings, theme: 'dark' } });
    render(<Harness />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  test('clears the attribute for system so the media query decides', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    useAppStore.setState({ settings: { ...initialState.settings, theme: 'system' } });
    render(<Harness />);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  test('updates the theme-color meta tag to match the resolved theme', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#000000';
    document.head.appendChild(meta);

    useAppStore.setState({ settings: { ...initialState.settings, theme: 'light' } });
    render(<Harness />);
    expect(meta.content.toLowerCase()).not.toBe('#000000');

    meta.remove();
  });
});
