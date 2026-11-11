import {
  GfReactHostComponent,
  type ReactHostRenderArgs
} from '@ghostfolio/client/components/react-host/react-host.component';
import { UserService } from '@ghostfolio/client/services/user/user.service';

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Issue #258 (Nov 10): standalone Risk route, same gf-react-host pattern
// Arthur's #257 already uses for the portfolio chart. Mounts the
// already-merged RiskDashboardCard/loadRiskDashboardSummary
// (GET /risk/score, /risk/concentration). The What-if simulator (PR #241)
// joins this page once it merges - not pulled in here to avoid depending
// on an unmerged branch.
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

  protected readonly renderRiskDashboard = async ({
    createElement,
    request
  }: ReactHostRenderArgs) => {
    const { RiskDashboardPage } =
      await import('@ghostfolio/react-ui/risk-dashboard/risk-dashboard-page');

    return createElement(RiskDashboardPage, { request });
  };

  private readonly destroyRef = inject(DestroyRef);
  private readonly userService = inject(UserService);

  public constructor() {
    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.colorScheme.set(state?.user?.settings?.colorScheme);
      });
  }
}
