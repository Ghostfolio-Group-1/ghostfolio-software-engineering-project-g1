import type { ReactHostRenderArgs } from '@ghostfolio/client/components/react-host/react-host.component';
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

jest.mock('@ghostfolio/react-ui/risk-dashboard/risk-dashboard-page', () => ({
  RiskDashboardPage: 'gf-mock-risk-dashboard-page'
}));

describe('GfRiskPageComponent', () => {
  let fixture: ComponentFixture<GfRiskPageComponent>;
  let stateChanged: Subject<{ user?: { settings?: { colorScheme?: string } } }>;

  beforeEach(async () => {
    stateChanged = new Subject();

    await TestBed.configureTestingModule({
      imports: [GfRiskPageComponent],
      providers: [
        {
          provide: UserService,
          useValue: { stateChanged }
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

  it('renders RiskDashboardPage through the host, passing the request through', async () => {
    fixture.detectChanges();

    const fakeCreateElement = jest.fn().mockReturnValue('rendered');
    const fakeRequest = jest.fn();

    const node = await fixture.componentInstance['renderRiskDashboard']({
      createElement: fakeCreateElement,
      request: fakeRequest
    } as unknown as ReactHostRenderArgs);

    expect(fakeCreateElement).toHaveBeenCalledWith(
      'gf-mock-risk-dashboard-page',
      { request: fakeRequest }
    );
    expect(node).toBe('rendered');
  });
});
