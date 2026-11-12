import type { ReactHostRenderArgs } from '@ghostfolio/client/components/react-host/react-host.component';
import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { GfRiskPageComponent } from './risk-page.component';

// Mocked out entirely: the real module transitively pulls in
// subscription-interstitial-dialog -> membership-card -> @ionic/angular,
// whose ESM build Jest can't parse. This page only needs stateChanged.
jest.mock('@ghostfolio/client/services/user/user.service', () => ({
  UserService: class {}
}));

jest.mock('@ghostfolio/react-ui/risk-dashboard/risk-page', () => ({
  RiskPage: 'gf-mock-risk-page'
}));

describe('GfRiskPageComponent', () => {
  let fixture: ComponentFixture<GfRiskPageComponent>;
  let stateChanged: Subject<{
    user?: { id?: string; settings?: { colorScheme?: string } };
  }>;
  let impersonationChanged: Subject<string | null>;

  beforeEach(async () => {
    stateChanged = new Subject();
    impersonationChanged = new Subject();

    await TestBed.configureTestingModule({
      imports: [GfRiskPageComponent],
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

    fixture = TestBed.createComponent(GfRiskPageComponent);
  });

  it('picks up the colorScheme from the user state', () => {
    fixture.detectChanges();

    stateChanged.next({ user: { settings: { colorScheme: 'DARK' } } });

    expect(fixture.componentInstance['colorScheme']()).toBe('DARK');
  });

  it('renders RiskPage through the host, passing the request through', async () => {
    fixture.detectChanges();

    const fakeCreateElement = jest.fn().mockReturnValue('rendered');
    const fakeRequest = jest.fn();

    const node = await fixture.componentInstance['renderRiskPage']({
      createElement: fakeCreateElement,
      request: fakeRequest
    } as unknown as ReactHostRenderArgs);

    expect(fakeCreateElement).toHaveBeenCalledWith('gf-mock-risk-page', {
      request: fakeRequest
    });
    expect(node).toBe('rendered');
  });

  // Tharun's review on #260: gf-react-host and useApiData only fetch on
  // mount, so switching identity would otherwise leave the previous user's
  // risk data on screen. The @for-keyed host must be a genuinely new DOM
  // node (a real destroy+recreate), not just the same element with updated
  // inputs, or the React tree inside it never remounts and never refetches.
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

  // Tharun's second-round review on #260: colorScheme and impersonation id
  // alone miss the case of switching to a different signed-in user who
  // happens to share the same theme and the same (lack of) impersonation -
  // the host must still remount so the new user's risk data loads.
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
