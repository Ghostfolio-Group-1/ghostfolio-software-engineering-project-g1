import type { UserService } from '@ghostfolio/client/services/user/user.service';
import { internalRoutes } from '@ghostfolio/common/routes/routes';

import type { ChangeDetectorRef, DestroyRef } from '@angular/core';
import { Subject } from 'rxjs';

import { PortfolioPageComponent } from './portfolio-page.component';
import { routes } from './portfolio-page.routes';

// Mocked out entirely, same reasoning as dashboard-page.component.spec.ts:
// the real module transitively pulls in subscription-interstitial-dialog ->
// membership-card -> @ionic/angular, whose ESM build Jest can't parse.
jest.mock('@ghostfolio/client/services/user/user.service', () => ({
  UserService: class {}
}));

// Also mocked: GfPageTabsComponent is referenced in @Component's `imports`
// array, which is evaluated at class-definition time even without
// TestBed ever compiling the component - and it transitively pulls in the
// same unparseable @ionic/angular/standalone ESM build.
jest.mock('@ghostfolio/ui/page-tabs', () => ({
  GfPageTabsComponent: class {}
}));

// Constructed directly rather than through TestBed: triggering Angular's
// component compiler would resolve GfPageTabsComponent's own imports,
// which transitively pull in @ionic/angular/standalone - an ESM build Jest
// can't parse (same issue noted in dashboard-page.component.spec.ts for a
// different transitive import). The tabs-building logic in the constructor
// is plain TypeScript, so it doesn't need Angular's DI or template
// compilation to exercise.
describe('PortfolioPageComponent', () => {
  let component: PortfolioPageComponent;
  let stateChanged: Subject<{ user?: unknown }>;

  beforeEach(() => {
    stateChanged = new Subject();

    const changeDetectorRef = { markForCheck: jest.fn() };
    const destroyRef = { onDestroy: () => jest.fn() };
    const userService = { stateChanged };

    component = new PortfolioPageComponent(
      changeDetectorRef as unknown as ChangeDetectorRef,
      destroyRef as unknown as DestroyRef,
      userService as unknown as UserService
    );
  });

  // #279: Risk had no nav-menu entry anywhere in the app, only reachable by
  // typing /risk directly. This is the regression check for that gap.
  it('includes a Risk tab pointing at the Portfolio sub-route', () => {
    stateChanged.next({ user: {} });

    const riskTab = component.tabs.find(
      (tab) => tab.label === internalRoutes.portfolio.subRoutes.risk.title
    );

    expect(riskTab).toBeDefined();
    expect(riskTab.routerLink).toEqual(
      internalRoutes.portfolio.subRoutes.risk.routerLink
    );
  });
});

describe('Portfolio routes', () => {
  // The tab above is only reachable if the route is actually registered -
  // this catches the tab and the route config drifting apart.
  it('registers a child route for the Risk sub-route', () => {
    const portfolioChildren = routes[0].children;
    const riskRoute = portfolioChildren.find(
      (route) => route.path === internalRoutes.portfolio.subRoutes.risk.path
    );

    expect(riskRoute).toBeDefined();
    expect(riskRoute.loadComponent).toBeDefined();
  });
});
