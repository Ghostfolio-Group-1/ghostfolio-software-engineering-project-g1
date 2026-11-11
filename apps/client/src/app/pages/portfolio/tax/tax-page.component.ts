import {
  GfReactHostComponent,
  type ReactHostRenderArgs
} from '@ghostfolio/client/components/react-host/react-host.component';
import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';
import { DEFAULT_COLOR_SCHEME } from '@ghostfolio/common/config';
import type { ColorScheme } from '@ghostfolio/common/types';

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GfReactHostComponent],
  selector: 'gf-tax-page',
  template: `
    <main aria-label="Tax analytics">
      @for (revision of [authRevision()]; track revision) {
        <gf-react-host
          [colorScheme]="colorScheme()"
          [renderReact]="renderTaxWorkspace"
        />
      }
    </main>
  `
})
export class GfTaxPageComponent {
  protected readonly authRevision = signal(0);
  protected readonly colorScheme = signal<ColorScheme>(DEFAULT_COLOR_SCHEME);

  protected readonly renderTaxWorkspace = async ({
    createElement,
    request
  }: ReactHostRenderArgs) => {
    const { TaxWorkspace } =
      await import('@ghostfolio/react-ui/tax-workspace/tax-workspace');

    return createElement(TaxWorkspace, { request });
  };

  private readonly destroyRef = inject(DestroyRef);
  private readonly impersonationStorageService = inject(
    ImpersonationStorageService
  );
  private readonly userService = inject(UserService);

  public constructor() {
    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.colorScheme.set(
          state?.user?.settings?.colorScheme ?? DEFAULT_COLOR_SCHEME
        );

        this.authRevision.update((revision) => revision + 1);
      });

    this.impersonationStorageService
      .onChangeHasImpersonation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.authRevision.update((revision) => revision + 1);
      });
  }
}
