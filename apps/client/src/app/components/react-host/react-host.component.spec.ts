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
});
