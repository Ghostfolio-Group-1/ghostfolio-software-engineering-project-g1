import {
  GfReactHostComponent,
  type ReactHostRenderArgs
} from '@ghostfolio/client/components/react-host/react-host.component';
import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
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
      @for (key of [renderKey()]; track key) {
        <gf-react-host
          [colorScheme]="colorScheme()"
          [renderReact]="renderTaxWorkspace"
        />
      }
    </main>
  `
})
export class GfTaxPageComponent {
  // Leave unset when the user has no explicit preference so gf-react-host
  // can follow Angular's theme-dark / OS dark (same as Risk/Dashboard).
  protected readonly colorScheme = signal<'DARK' | 'LIGHT' | undefined>(
    undefined
  );
  protected readonly impersonationId = signal<string | null>(null);
  protected readonly userId = signal<string | undefined>(undefined);

  // Match the Risk page: remount only when authentication identity, theme,
  // or impersonation actually changes. A generic stateChanged event must
  // not reset the active Tax view or trigger extra live API requests.
  protected readonly renderKey = computed(
    () =>
      `${this.colorScheme() ?? 'LIGHT'}:${this.impersonationId() ?? ''}:${this.userId() ?? ''}`
  );

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
        this.colorScheme.set(state?.user?.settings?.colorScheme);
        this.userId.set(state?.user?.id);
      });

    this.impersonationStorageService
      .onChangeHasImpersonation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((impersonationId) => {
        this.impersonationId.set(impersonationId);
      });
  }
}
