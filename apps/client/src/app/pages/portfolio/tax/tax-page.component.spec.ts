import {
  GfReactHostComponent,
  type ReactHostRenderArgs
} from '@ghostfolio/client/components/react-host/react-host.component';
import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import type { ColorScheme } from '@ghostfolio/common/types';

import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '@angular/localize/init';
import { By } from '@angular/platform-browser';
import type { ReactNode } from 'react';
import { BehaviorSubject, Subject } from 'rxjs';

jest.mock('@ghostfolio/client/services/user/user.service', () => ({
  UserService: class MockUserService {}
}));

jest.mock('@ghostfolio/react-ui/tax-workspace/tax-workspace', () => ({
  TaxWorkspace: () => null
}));

const { UserService } = jest.requireMock(
  '@ghostfolio/client/services/user/user.service'
) as {
  UserService: typeof import('@ghostfolio/client/services/user/user.service').UserService;
};

const { GfTaxPageComponent } =
  require('./tax-page.component') as typeof import('./tax-page.component');
@Component({
  selector: 'gf-react-host',
  template: ''
})
class TestReactHostComponent {
  public readonly colorScheme = input<ColorScheme | null | undefined>();

  public readonly renderReact =
    input.required<
      (args: ReactHostRenderArgs) => Promise<ReactNode> | ReactNode
    >();
}

describe('GfTaxPageComponent', () => {
  let fixture: ComponentFixture<InstanceType<typeof GfTaxPageComponent>>;
  let userChanges: Subject<{
    user?: { id?: string; settings?: { colorScheme?: ColorScheme } };
  }>;
  let impersonationChanges: BehaviorSubject<string | null>;

  function getHost(): TestReactHostComponent {
    return fixture.debugElement.query(By.directive(TestReactHostComponent))
      .componentInstance as TestReactHostComponent;
  }

  beforeEach(async () => {
    userChanges = new Subject();
    impersonationChanges = new BehaviorSubject<string | null>(null);

    await TestBed.configureTestingModule({
      imports: [GfTaxPageComponent],
      providers: [
        {
          provide: UserService,
          useValue: {
            stateChanged: userChanges.asObservable()
          }
        },
        {
          provide: ImpersonationStorageService,
          useValue: {
            onChangeHasImpersonation: () => impersonationChanges.asObservable()
          }
        }
      ]
    })
      .overrideComponent(GfTaxPageComponent, {
        remove: { imports: [GfReactHostComponent] },
        add: { imports: [TestReactHostComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(GfTaxPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    userChanges.complete();
    impersonationChanges.complete();
  });

  it('mounts the Tax React host', () => {
    expect(
      fixture.nativeElement.querySelector('main[aria-label="Tax analytics"]')
    ).not.toBeNull();

    expect(getHost().colorScheme()).toBeUndefined();
    expect(typeof getHost().renderReact()).toBe('function');
  });

  it('passes the host request adapter to TaxWorkspace', async () => {
    const request = jest.fn() as unknown as ReactHostRenderArgs['request'];
    const createElementMock = jest.fn(() => null);

    await getHost().renderReact()({
      createElement:
        createElementMock as unknown as ReactHostRenderArgs['createElement'],
      request
    });

    expect(createElementMock).toHaveBeenCalledWith(expect.any(Function), {
      request
    });
  });

  it('recreates the host when the user state changes', () => {
    const originalHost = getHost();

    userChanges.next({
      user: { settings: { colorScheme: 'DARK' } }
    });

    fixture.detectChanges();

    expect(getHost()).not.toBe(originalHost);
    expect(getHost().colorScheme()).toBe('DARK');

    const authenticatedHost = getHost();

    userChanges.next({ user: undefined });
    fixture.detectChanges();

    expect(getHost()).not.toBe(authenticatedHost);
    expect(getHost().colorScheme()).toBeUndefined();
  });

  it('recreates the host when impersonation changes', () => {
    const originalHost = getHost();

    impersonationChanges.next('another-user');
    fixture.detectChanges();

    expect(getHost()).not.toBe(originalHost);
    expect(getHost().colorScheme()).toBeUndefined();
  });

  it('does not recreate the host on unrelated user state emissions', () => {
    userChanges.next({
      user: { id: 'user-1', settings: { colorScheme: 'DARK' } }
    });
    fixture.detectChanges();
    const originalHost = getHost();

    userChanges.next({
      user: { id: 'user-1', settings: { colorScheme: 'DARK' } }
    });
    fixture.detectChanges();

    expect(getHost()).toBe(originalHost);
  });

  it('recreates the host when the signed-in user changes with the same theme', () => {
    userChanges.next({
      user: { id: 'user-1', settings: { colorScheme: 'DARK' } }
    });
    fixture.detectChanges();
    const originalHost = getHost();

    userChanges.next({
      user: { id: 'user-2', settings: { colorScheme: 'DARK' } }
    });
    fixture.detectChanges();

    expect(getHost()).not.toBe(originalHost);
    expect(getHost().colorScheme()).toBe('DARK');
  });

  it('does not recreate the host when the impersonation ID is unchanged', () => {
    impersonationChanges.next('another-user');
    fixture.detectChanges();
    const originalHost = getHost();

    impersonationChanges.next('another-user');
    fixture.detectChanges();

    expect(getHost()).toBe(originalHost);
  });
});
