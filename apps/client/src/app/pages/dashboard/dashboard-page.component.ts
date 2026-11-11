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

// Unified Dashboard route (Wed Nov 11): mounts DashboardOverviewPage
// (GET /api/v1/dashboard/overview: Risk, Tax and Performance cards plus the
// partial-failure notice) through the shared gf-react-host, the same
// pattern as the Risk page (#260).
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page' },
  imports: [GfReactHostComponent],
  selector: 'gf-dashboard-page',
  styleUrl: './dashboard-page.component.scss',
  templateUrl: './dashboard-page.component.html'
})
export class GfDashboardPageComponent {
  protected readonly colorScheme = signal<'DARK' | 'LIGHT' | undefined>(
    undefined
  );

  protected readonly impersonationId = signal<string | null>(null);

  protected readonly userId = signal<string | undefined>(undefined);

  // gf-react-host and useApiData fetch only on mount, so the host is keyed
  // on theme, impersonation and user: any change destroys and recreates it,
  // which refetches the overview for the new identity (same fix as #260).
  protected readonly renderKey = computed(
    () =>
      `${this.colorScheme() ?? 'LIGHT'}:${this.impersonationId() ?? ''}:${this.userId() ?? ''}`
  );

  protected readonly renderDashboard = async ({
    createElement,
    request
  }: ReactHostRenderArgs) => {
    const { DashboardOverviewPage } =
      await import('@ghostfolio/react-ui/dashboard-page/dashboard-overview-page');

    return createElement(DashboardOverviewPage, { request });
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
