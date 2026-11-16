import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { TokenStorageService } from '@ghostfolio/client/services/token-storage.service';
import {
  HEADER_KEY_IMPERSONATION,
  HEADER_KEY_TIMEZONE,
  HEADER_KEY_TOKEN
} from '@ghostfolio/common/config';
import type { AuthenticatedFetch } from '@ghostfolio/react-ui/data/api-request';

import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ReactNode } from 'react';

import {
  GfReactHostComponent,
  type ReactHostRenderArgs
} from './react-host.component';

jest.mock('@ghostfolio/react-ui/theme/theme-provider', () => ({
  ThemeProvider: ({ children }: { children?: ReactNode }) => children ?? null
}));

jest.mock('@ghostfolio/react-ui/theme/theme', () => ({
  darkTheme: { name: 'dark' },
  lightTheme: { name: 'light' }
}));

describe('GfReactHostComponent', () => {
  let fixture: ComponentFixture<GfReactHostComponent>;
  let impersonationId: string | null;
  let token: string | null;
  let capturedRequest: AuthenticatedFetch | undefined;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    impersonationId = null;
    token = null;
    capturedRequest = undefined;
    document.body.classList.remove('theme-dark', 'theme-light');
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200
    });
    global.fetch = fetchMock as typeof fetch;

    await TestBed.configureTestingModule({
      imports: [GfReactHostComponent],
      providers: [
        {
          provide: ImpersonationStorageService,
          useValue: {
            getId: () => impersonationId
          }
        },
        {
          provide: TokenStorageService,
          useValue: {
            getToken: () => token
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GfReactHostComponent);
    fixture.componentRef.setInput(
      'renderReact',
      async ({ createElement, request }: ReactHostRenderArgs) => {
        capturedRequest = request;

        return createElement(
          'div',
          {
            'data-testid': 'react-host-ready'
          },
          'ready'
        );
      }
    );
    fixture.componentRef.setInput('colorScheme', 'LIGHT');
  });

  afterEach(() => {
    fixture?.destroy();
  });

  async function settleHost(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
  }

  it('sends Authorization, Timezone, and Impersonation-Id when a token is set', async () => {
    token = 'test-token';
    impersonationId = 'impersonated-user';

    await settleHost();

    expect(capturedRequest).toBeDefined();
    await capturedRequest!('/api/v1/example');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/example',
      expect.objectContaining({
        credentials: 'same-origin',
        headers: expect.any(Headers)
      })
    );

    const headers = fetchMock.mock.calls[0][1].headers as Headers;

    expect(headers.get(HEADER_KEY_TOKEN)).toBe('Bearer test-token');
    expect(headers.get(HEADER_KEY_IMPERSONATION)).toBe('impersonated-user');
    expect(headers.get(HEADER_KEY_TIMEZONE)).toBeTruthy();
  });

  it('omits Authorization and Impersonation-Id when there is no token', async () => {
    token = null;
    impersonationId = 'impersonated-user';

    await settleHost();

    expect(capturedRequest).toBeDefined();
    await capturedRequest!('/api/v1/example');

    const headers = fetchMock.mock.calls[0][1].headers as Headers;

    expect(headers.get(HEADER_KEY_TOKEN)).toBeNull();
    expect(headers.get(HEADER_KEY_IMPERSONATION)).toBeNull();
    expect(headers.get(HEADER_KEY_TIMEZONE)).toBeTruthy();
  });

  it('unmounts on destroy and does not render a late result', async () => {
    let resolveNode!: (node: ReactNode) => void;
    const pendingNode = new Promise<ReactNode>((resolve) => {
      resolveNode = resolve;
    });

    fixture.componentRef.setInput(
      'renderReact',
      async ({ createElement }: ReactHostRenderArgs) => {
        return pendingNode.then((node) => node ?? createElement('div'));
      }
    );

    fixture.detectChanges();
    fixture.destroy();

    const { createElement } = await import('react');

    resolveNode(
      createElement('div', { 'data-testid': 'react-host-late' }, 'late')
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(
      document.querySelector('[data-testid="react-host-late"]')
    ).toBeNull();
    expect(
      document.querySelector('[data-testid="react-host-ready"]')
    ).toBeNull();
  });

  describe('system color scheme listener', () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    function installMatchMedia(): {
      addEventListener: jest.Mock;
      removeEventListener: jest.Mock;
    } {
      const query = {
        addEventListener: jest.fn(),
        matches: false,
        removeEventListener: jest.fn()
      };

      window.matchMedia = jest
        .fn()
        .mockReturnValue(query) as typeof window.matchMedia;

      return query;
    }

    it('adds a matchMedia listener when the scheme is unset', async () => {
      const query = installMatchMedia();

      fixture.componentRef.setInput('colorScheme', null);
      await settleHost();

      expect(window.matchMedia).toHaveBeenCalledWith(
        '(prefers-color-scheme: dark)'
      );
      expect(query.addEventListener).toHaveBeenCalledTimes(1);
      expect(query.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
      expect(query.removeEventListener).not.toHaveBeenCalled();
    });

    it('removes the listener when the scheme becomes DARK', async () => {
      const query = installMatchMedia();

      fixture.componentRef.setInput('colorScheme', null);
      await settleHost();

      const handler = query.addEventListener.mock.calls[0][1];

      fixture.componentRef.setInput('colorScheme', 'DARK');
      await settleHost();

      expect(query.removeEventListener).toHaveBeenCalledWith('change', handler);
    });

    it('removes the listener when the scheme becomes LIGHT', async () => {
      const query = installMatchMedia();

      fixture.componentRef.setInput('colorScheme', undefined);
      await settleHost();

      const handler = query.addEventListener.mock.calls[0][1];

      fixture.componentRef.setInput('colorScheme', 'LIGHT');
      await settleHost();

      expect(query.removeEventListener).toHaveBeenCalledWith('change', handler);
    });

    it('removes the listener on destroy', async () => {
      const query = installMatchMedia();

      fixture.componentRef.setInput('colorScheme', null);
      await settleHost();

      const handler = query.addEventListener.mock.calls[0][1];

      fixture.destroy();

      expect(query.removeEventListener).toHaveBeenCalledWith('change', handler);
    });
  });
});
