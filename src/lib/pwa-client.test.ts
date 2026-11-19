import { describe, expect, it, vi } from 'vitest';
import {
  createInstallPromptController,
  registerPwaServiceWorker,
  type BeforeInstallPromptEvent,
} from './pwa-client';

function createEventTargetMock() {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  return {
    addEventListener(type: string, cb: (event: unknown) => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(cb);
      listeners.set(type, set);
    },
    removeEventListener(type: string, cb: (event: unknown) => void) {
      listeners.get(type)?.delete(cb);
    },
    dispatch(type: string, event: unknown) {
      for (const cb of listeners.get(type) ?? []) {
        cb(event);
      }
    },
  };
}

describe('PWA client registration and install prompt lifecycle (Seam 3)', () => {
  it('registers /sw.js with root scope when serviceWorker is supported', async () => {
    const register = vi.fn(async () => ({ scope: '/' }));
    const registered = await registerPwaServiceWorker({
      serviceWorker: { register },
    });

    expect(registered).toBe(true);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('returns false gracefully when serviceWorker is unavailable or registration fails', async () => {
    expect(await registerPwaServiceWorker({})).toBe(false);

    const failingRegister = vi.fn(async () => {
      throw new Error('Blocked');
    });
    expect(
      await registerPwaServiceWorker({ serviceWorker: { register: failingRegister } }),
    ).toBe(false);
  });

  it('captures beforeinstallprompt, exposes availability, triggers native install, and hides after acceptance', async () => {
    const win = createEventTargetMock();
    const states: boolean[] = [];

    const controller = createInstallPromptController(win, (canInstall) => {
      states.push(canInstall);
    });

    expect(controller.canInstall()).toBe(false);

    const preventDefault = vi.fn();
    const prompt = vi.fn(async () => undefined);
    const fakeEvent: BeforeInstallPromptEvent = {
      preventDefault,
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    win.dispatch('beforeinstallprompt', fakeEvent);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(controller.canInstall()).toBe(true);
    expect(states).toEqual([true]);

    const outcome = await controller.triggerInstall();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('accepted');
    expect(controller.canInstall()).toBe(false);
    expect(states).toEqual([true, false]);

    controller.dispose();
  });

  it('clears install availability when appinstalled fires', () => {
    const win = createEventTargetMock();
    const states: boolean[] = [];
    const controller = createInstallPromptController(win, (canInstall) => {
      states.push(canInstall);
    });

    win.dispatch('beforeinstallprompt', {
      preventDefault: vi.fn(),
      prompt: vi.fn(async () => undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    expect(controller.canInstall()).toBe(true);

    win.dispatch('appinstalled', {});
    expect(controller.canInstall()).toBe(false);
    expect(states).toEqual([true, false]);

    controller.dispose();
  });
});
