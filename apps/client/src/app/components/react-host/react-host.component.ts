import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { TokenStorageService } from '@ghostfolio/client/services/token-storage.service';
import {
  DEFAULT_COLOR_SCHEME,
  HEADER_KEY_IMPERSONATION,
  HEADER_KEY_TIMEZONE,
  HEADER_KEY_TOKEN
} from '@ghostfolio/common/config';
import type { ColorScheme } from '@ghostfolio/common/types';
import type { AuthenticatedFetch } from '@ghostfolio/react-ui/data/api-request';

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
  untracked
} from '@angular/core';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import {
  resolveReactHostColorScheme,
  systemPrefersDarkColorScheme
} from './resolve-react-host-color-scheme';

export interface ReactHostRenderArgs {
  createElement: typeof import('react').createElement;
  request: AuthenticatedFetch;
}

/**
 * Mounts one React tree for any screen. The screen supplies the tree. This
 * host supplies the authenticated fetch and the user's color scheme.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'gf-react-host',
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .react-host-mount {
        width: 100%;
      }
    `
  ],
  template: '<div #mount class="react-host-mount"></div>'
})
export class GfReactHostComponent implements AfterViewInit, OnDestroy {
  public readonly colorScheme = input<ColorScheme | null | undefined>(
    DEFAULT_COLOR_SCHEME
  );

  public readonly renderReact =
    input.required<
      (args: ReactHostRenderArgs) => Promise<ReactNode> | ReactNode
    >();

  @ViewChild('mount', { static: true })
  private mount!: ElementRef<HTMLElement>;

  private reactRoot?: Root;

  private destroyed = false;

  private renderGeneration = 0;

  private systemColorSchemeQuery?: MediaQueryList;

  private readonly onSystemColorSchemeChange = () => {
    if (this.destroyed) {
      return;
    }

    // User has no explicit preference — follow the OS like app.component.
    if (this.colorScheme() === 'DARK' || this.colorScheme() === 'LIGHT') {
      return;
    }

    void this.renderTree(this.resolveColorScheme(this.colorScheme()));
  };

  private readonly impersonationStorageService = inject(
    ImpersonationStorageService
  );

  private readonly injector = inject(Injector);

  private readonly tokenStorageService = inject(TokenStorageService);

  public ngAfterViewInit(): void {
    effect(
      () => {
        // Only colorScheme is tracked. Screens should pass a stable
        // renderReact reference; a new callback does not remount on its own.
        const scheme = this.resolveColorScheme(this.colorScheme());

        untracked(() => {
          this.syncSystemColorSchemeListener(this.colorScheme());
          void this.renderTree(scheme);
        });
      },
      { injector: this.injector }
    );
  }

  public ngOnDestroy(): void {
    this.destroyed = true;
    this.renderGeneration += 1;
    this.teardownSystemColorSchemeListener();
    this.reactRoot?.unmount();
    this.reactRoot = undefined;
  }

  private resolveColorScheme(
    scheme: ColorScheme | null | undefined
  ): ColorScheme {
    return resolveReactHostColorScheme({
      documentHasDarkClass: document.body.classList.contains('theme-dark'),
      documentHasLightClass: document.body.classList.contains('theme-light'),
      scheme,
      systemPrefersDark: systemPrefersDarkColorScheme()
    });
  }

  private syncSystemColorSchemeListener(
    scheme: ColorScheme | null | undefined
  ): void {
    if (scheme === 'DARK' || scheme === 'LIGHT') {
      this.teardownSystemColorSchemeListener();
      return;
    }

    if (
      this.systemColorSchemeQuery ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    this.systemColorSchemeQuery = window.matchMedia(
      '(prefers-color-scheme: dark)'
    );
    this.systemColorSchemeQuery.addEventListener(
      'change',
      this.onSystemColorSchemeChange
    );
  }

  private teardownSystemColorSchemeListener(): void {
    this.systemColorSchemeQuery?.removeEventListener(
      'change',
      this.onSystemColorSchemeChange
    );
    this.systemColorSchemeQuery = undefined;
  }

  private readonly request: AuthenticatedFetch = (fetchInput, init) => {
    const headers = new Headers(init?.headers);

    headers.set(
      HEADER_KEY_TIMEZONE,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
    headers.set('Accept', 'application/json');

    const token = this.tokenStorageService.getToken();

    if (token) {
      headers.set(HEADER_KEY_TOKEN, `Bearer ${token}`);

      const impersonationId = this.impersonationStorageService.getId();

      if (impersonationId) {
        headers.set(HEADER_KEY_IMPERSONATION, impersonationId);
      }
    }

    return fetch(fetchInput, {
      ...init,
      credentials: 'same-origin',
      headers
    });
  };

  private async renderTree(scheme: ColorScheme): Promise<void> {
    const generation = ++this.renderGeneration;

    try {
      // react-ui stays a dynamic import (Nx enforces it lazy-loaded here).
      // react/react-dom are static above: esbuild wraps them as CommonJS,
      // and a *dynamic* import() of a CJS chunk returns the raw require()
      // wrapper, not named exports - createElement/createRoot would be
      // undefined at runtime. A static import gets bundler-synthesized
      // named bindings instead, which actually works.
      const { ThemeProvider } =
        await import('@ghostfolio/react-ui/theme/theme-provider');
      const { darkTheme, lightTheme } =
        await import('@ghostfolio/react-ui/theme/theme');

      if (this.destroyed || generation !== this.renderGeneration) {
        return;
      }

      const node = await this.renderReact()({
        createElement,
        request: this.request
      });

      if (this.destroyed || generation !== this.renderGeneration) {
        return;
      }

      this.reactRoot ??= createRoot(this.mount.nativeElement);
      this.reactRoot.render(
        createElement(
          ThemeProvider,
          {
            theme: scheme === 'DARK' ? darkTheme : lightTheme
          },
          node
        )
      );
    } catch (error) {
      console.error(error);

      if (this.destroyed || generation !== this.renderGeneration) {
        return;
      }

      this.renderFallback();
    }
  }

  private renderFallback(): void {
    this.reactRoot?.unmount();
    this.reactRoot = undefined;

    const message = document.createElement('p');

    message.dataset['testid'] = 'react-host-error';
    message.style.color = '#757575';
    message.style.margin = '0';
    message.textContent = 'This section could not be loaded';

    this.mount.nativeElement.replaceChildren(message);
  }
}
