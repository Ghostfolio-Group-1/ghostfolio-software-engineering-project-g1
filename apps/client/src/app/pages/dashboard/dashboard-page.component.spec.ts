import type { ReactHostRenderArgs } from '@ghostfolio/client/components/react-host/react-host.component';
import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { GfDashboardPageComponent } from './dashboard-page.component';

// Mocked out entirely: the real module transitively pulls in
// subscription-interstitial-dialog -> membership-card -> @ionic/angular,
// whose ESM build Jest can't parse. This page only needs stateChanged.
jest.mock('@ghostfolio/client/services/user/user.service', () => ({
  UserService: class {}
}));

jest.mock(
  '@ghostfolio/react-ui/dashboard-page/dashboard-overview-page',
  () => ({
    DashboardOverviewPage: 'gf-mock-dashboard-overview-page'
  })
);

describe('GfDashboardPageComponent', () => {
  let fixture: ComponentFixture<GfDashboardPageComponent>;
  let stateChanged: Subject<{
    user?: { id?: string; settings?: { colorScheme?: string } };
  }>;
  let impersonationChanged: Subject<string | null>;

  beforeEach(async () => {
    stateChanged = new Subject();
    impersonationChanged = new Subject();

    await TestBed.configureTestingModule({
      imports: [GfDashboardPageComponent],
      providers: [
        {
          provide: UserService,
          useValue: { stateChanged }
        },
        {
          provide: ImpersonationStorageService,
          useValue: {
            onChangeHasImpersonation: () => impersonationChanged.asObservable()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GfDashboardPageComponent);
  });

  it('picks up the colorScheme from the user state', () => {
    fixture.detectChanges();

    stateChanged.next({ user: { settings: { colorScheme: 'DARK' } } });

    expect(fixture.componentInstance['colorScheme']()).toBe('DARK');
  });

  it('renders DashboardOverviewPage through the host, passing the request through', async () => {
    fixture.detectChanges();

    const fakeCreateElement = jest.fn().mockReturnValue('rendered');
    const fakeRequest = jest.fn();

    const node = await fixture.componentInstance['renderDashboard']({
      createElement: fakeCreateElement,
      request: fakeRequest
    } as unknown as ReactHostRenderArgs);

    expect(fakeCreateElement).toHaveBeenCalledWith(
      'gf-mock-dashboard-overview-page',
      { request: fakeRequest }
    );
    expect(node).toBe('rendered');
  });

  // gf-react-host and useApiData only fetch on mount, so switching identity
  // must create a new host DOM node, or the previous user's overview stays.
  it('remounts the host (a new DOM node) when the impersonation id changes', () => {
    fixture.detectChanges();

    const hostBefore = fixture.nativeElement.querySelector('gf-react-host');

    expect(hostBefore).not.toBeNull();

    impersonationChanged.next('impersonated-user');
    fixture.detectChanges();

    const hostAfter = fixture.nativeElement.querySelector('gf-react-host');

    expect(hostAfter).not.toBeNull();
    expect(hostAfter).not.toBe(hostBefore);
  });

  it('does not remount the host when nothing relevant changes', () => {
    fixture.detectChanges();

    const hostBefore = fixture.nativeElement.querySelector('gf-react-host');

    fixture.detectChanges();

    const hostAfter = fixture.nativeElement.querySelector('gf-react-host');

    expect(hostAfter).toBe(hostBefore);
  });

  // A different signed-in user with the same theme and no impersonation
  // must still remount the host so the new user's overview loads.
  it('remounts the host when the signed-in user changes, even with the same colorScheme and no impersonation', () => {
    fixture.detectChanges();
    stateChanged.next({
      user: { id: 'user-1', settings: { colorScheme: 'DARK' } }
    });
    fixture.detectChanges();

    const hostBefore = fixture.nativeElement.querySelector('gf-react-host');

    stateChanged.next({
      user: { id: 'user-2', settings: { colorScheme: 'DARK' } }
    });
    fixture.detectChanges();

    const hostAfter = fixture.nativeElement.querySelector('gf-react-host');

    expect(hostAfter).not.toBeNull();
    expect(hostAfter).not.toBe(hostBefore);
  });
});
