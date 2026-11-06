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
import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';

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
  template: '<div #mount></div>'
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

  private readonly impersonationStorageService = inject(
    ImpersonationStorageService
  );

  private readonly injector = inject(Injector);

  private readonly tokenStorageService = inject(TokenStorageService);

  public ngAfterViewInit(): void {
    effect(
      () => {
        const scheme = this.colorScheme() ?? DEFAULT_COLOR_SCHEME;

        untracked(() => {
          void this.renderTree(scheme);
        });
      },
      { injector: this.injector }
    );
  }

  public ngOnDestroy(): void {
    this.destroyed = true;
    this.renderGeneration += 1;
    this.reactRoot?.unmount();
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
    const [
      { createElement },
      { createRoot },
      { ThemeProvider },
      { darkTheme, lightTheme }
    ] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('@ghostfolio/react-ui/theme/theme-provider'),
      import('@ghostfolio/react-ui/theme/theme')
    ]);

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
        { theme: scheme === 'DARK' ? darkTheme : lightTheme },
        node
      )
    );
  }
}
