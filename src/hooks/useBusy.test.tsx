import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useBusy } from './useBusy';

test('ignores a second call while the first is in flight', async () => {
  let finish!: () => void;
  const action = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  const { result } = renderHook(() => useBusy());

  let first!: Promise<void>;
  act(() => {
    first = result.current[1](action);
    void result.current[1](action); // double tap in the same tick
  });
  expect(result.current[0]).toBe(true);
  expect(action).toHaveBeenCalledOnce();

  await act(async () => {
    finish();
    await first;
  });
  expect(result.current[0]).toBe(false);
});

test('clears busy when the action throws', async () => {
  const { result } = renderHook(() => useBusy());
  await act(async () => {
    await result.current[1](async () => {
      throw new Error('nope');
    }).catch(() => {});
  });
  expect(result.current[0]).toBe(false);
});
