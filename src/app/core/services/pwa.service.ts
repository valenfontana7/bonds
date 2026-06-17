import { Injectable, computed, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaService {
  readonly canInstall = signal(false);
  readonly isStandalone = signal(this.detectStandalone());
  readonly updateAvailable = signal(false);
  readonly showInstallBanner = computed(() => {
    if (this.isStandalone() || !this.canInstall()) return false;
    const dismissed = localStorage.getItem('bonds.install.dismissed');
    if (!dismissed) return true;
    return Date.now() - Number(dismissed) > 7 * 86_400_000;
  });

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  constructor(private readonly swUpdate: SwUpdate) {
    this.syncViewportMetricsDeferred();
    window.addEventListener('resize', () => this.syncViewportMetricsDeferred());
    window.addEventListener('orientationchange', () => this.syncViewportMetricsDeferred());
    window.visualViewport?.addEventListener('resize', () => this.syncViewportMetricsDeferred());

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall.set(false);
      this.isStandalone.set(true);
      this.syncViewportMetricsDeferred();
    });

    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
        .subscribe(() => this.updateAvailable.set(true));

      this.swUpdate.checkForUpdate();
    }
  }

  async install(): Promise<boolean> {
    if (!this.deferredPrompt) return false;
    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);
    return outcome === 'accepted';
  }

  async applyUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) return;
    await this.swUpdate.activateUpdate();
    document.location.reload();
  }

  dismissInstall(): void {
    localStorage.setItem('bonds.install.dismissed', Date.now().toString());
  }

  /** iOS PWA: sincroniza altura real y safe areas (env() falla en standalone). */
  syncViewportMetrics(): void {
    const root = document.documentElement;
    root.style.setProperty('--app-height', `${window.innerHeight}px`);

    const sat = this.readSafeAreaInset('top');
    let sab = this.readSafeAreaInset('bottom');
    const sar = this.readSafeAreaInset('right');
    const sal = this.readSafeAreaInset('left');

    if (this.isIos() && this.isStandalone() && sab === 0) {
      sab = 34;
    }

    root.style.setProperty('--sat', `${sat}px`);
    root.style.setProperty('--sab', `${sab}px`);
    root.style.setProperty('--sar', `${sar}px`);
    root.style.setProperty('--sal', `${sal}px`);
  }

  syncViewportMetricsDeferred(): void {
    this.syncViewportMetrics();
    requestAnimationFrame(() => this.syncViewportMetrics());
    setTimeout(() => this.syncViewportMetrics(), 150);
    setTimeout(() => this.syncViewportMetrics(), 500);
  }

  private readSafeAreaInset(side: 'top' | 'bottom' | 'left' | 'right'): number {
    if (!document.body) return 0;

    const probe = document.createElement('div');
    probe.style.cssText = [
      'position:fixed',
      'visibility:hidden',
      'pointer-events:none',
      `padding-${side}:env(safe-area-inset-${side})`,
    ].join(';');
    document.body.appendChild(probe);
    const value = parseFloat(getComputedStyle(probe).getPropertyValue(`padding-${side}`)) || 0;
    probe.remove();
    return value;
  }

  private isIos(): boolean {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }

  private detectStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
    );
  }
}
