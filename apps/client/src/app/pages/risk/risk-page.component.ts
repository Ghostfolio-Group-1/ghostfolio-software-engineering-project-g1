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

// Issue #258 (Nov 10): standalone Risk route, same gf-react-host pattern
// Arthur's #257 already uses for the portfolio chart. Mounts the
// already-merged RiskDashboardCard/loadRiskDashboardSummary
// (GET /risk/score, /risk/concentration), and, per issue #261, the
// What-if simulator (PR #241) alongside it through the same gf-react-host.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page' },
  imports: [GfReactHostComponent],
  selector: 'gf-risk-page',
  styleUrl: './risk-page.component.scss',
  templateUrl: './risk-page.component.html'
})
export class GfRiskPageComponent {
  protected readonly colorScheme = signal<'DARK' | 'LIGHT' | undefined>(
    undefined
  );

  protected readonly impersonationId = signal<string | null>(null);

  protected readonly userId = signal<string | undefined>(undefined);

  // gf-react-host only re-renders its tree when colorScheme changes (its own
  // ngAfterViewInit effect tracks nothing else), so neither it nor
  // useApiData refetches on identity changes by itself. Tharun's review on
  // #260: the previous user's risk data would stay on screen across an
  // impersonation change, and (second round) across a user change that
  // leaves colorScheme/impersonation untouched (e.g. signing in as a
  // different user with the same theme, no impersonation either way).
  // Keying the @for in the template on this forces Angular to fully
  // destroy and recreate <gf-react-host>, which reruns renderRiskDashboard
  // and therefore refetches via useApiData's mount-time fetch.
  protected readonly renderKey = computed(
    () =>
      `${this.colorScheme() ?? 'LIGHT'}:${this.impersonationId() ?? ''}:${this.userId() ?? ''}`
  );

  protected readonly renderRiskPage = async ({
    createElement,
    request
  }: ReactHostRenderArgs) => {
    const { RiskPage } =
      await import('@ghostfolio/react-ui/risk-dashboard/risk-page');

    return createElement(RiskPage, { request });
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
