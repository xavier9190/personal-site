export interface BeforeInstallPromptEvent {
  preventDefault(): void;
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface ServiceWorkerContainerLike {
  register(scriptURL: string, options?: { scope?: string }): Promise<unknown>;
}

export interface NavigatorLike {
  serviceWorker?: ServiceWorkerContainerLike;
}

export interface EventTargetLike {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
}

export interface InstallPromptController {
  canInstall(): boolean;
  triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dispose(): void;
}

export async function registerPwaServiceWorker(
  nav: NavigatorLike | undefined = typeof navigator !== 'undefined' ? navigator : undefined,
): Promise<boolean> {
  if (!nav || !nav.serviceWorker || typeof nav.serviceWorker.register !== 'function') {
    return false;
  }

  try {
    await nav.serviceWorker.register('/sw.js', { scope: '/' });
    return true;
  } catch {
    return false;
  }
}

function isBeforeInstallPromptEvent(event: unknown): event is BeforeInstallPromptEvent {
  if (!event || typeof event !== 'object') return false;
  const candidate = event as Partial<BeforeInstallPromptEvent>;
  return (
    typeof candidate.preventDefault === 'function' &&
    typeof candidate.prompt === 'function' &&
    candidate.userChoice instanceof Promise
  );
}

export function createInstallPromptController(
  win: EventTargetLike,
  onAvailabilityChange?: (canInstall: boolean) => void,
): InstallPromptController {
  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  const notify = (available: boolean) => {
    onAvailabilityChange?.(available);
  };

  const handleBeforeInstallPrompt = (event: unknown) => {
    if (!isBeforeInstallPromptEvent(event)) return;
    event.preventDefault();
    deferredPrompt = event;
    notify(true);
  };

  const handleAppInstalled = () => {
    deferredPrompt = null;
    notify(false);
  };

  win.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  win.addEventListener('appinstalled', handleAppInstalled);

  return {
    canInstall() {
      return deferredPrompt !== null;
    },
    async triggerInstall() {
      if (!deferredPrompt) {
        return 'unavailable';
      }
      const promptEvent = deferredPrompt;
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      deferredPrompt = null;
      notify(false);
      return choice.outcome;
    },
    dispose() {
      win.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      win.removeEventListener('appinstalled', handleAppInstalled);
    },
  };
}
