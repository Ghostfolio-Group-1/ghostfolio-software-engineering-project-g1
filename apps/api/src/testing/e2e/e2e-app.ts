import { HasPermissionGuard } from '@ghostfolio/api/guards/has-permission.guard';
import { ImpersonationGuard } from '@ghostfolio/api/guards/impersonation.guard';
import { scopes } from '@ghostfolio/common/scopes';

import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  VersioningType
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TestingModuleBuilder } from '@nestjs/testing';

// Request headers that switch the stand-in login for a single request.
export const E2E_NO_LOGIN = { 'x-test-auth': 'none' };
export const E2E_NO_SCOPES = { 'x-test-scopes': 'none' };

// Replaces the JWT login, permission and impersonation guards with stand-ins
// that act as the given user. The real ScopeGuard still runs, so scope checks
// are tested end to end.
export function withE2eUser(
  builder: TestingModuleBuilder,
  { baseCurrency, userId }: { baseCurrency: string; userId: string }
): TestingModuleBuilder {
  const request = (context: ExecutionContext) => {
    return context.switchToHttp().getRequest();
  };

  return builder
    .overrideGuard(AuthGuard('jwt'))
    .useValue({
      canActivate: (context: ExecutionContext) => {
        if (request(context).headers['x-test-auth'] === 'none') {
          throw new UnauthorizedException();
        }

        request(context).user = { id: userId };

        return true;
      }
    })
    .overrideGuard(HasPermissionGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(ImpersonationGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const noScopes = request(context).headers['x-test-scopes'] === 'none';

        request(context).impersonation = {
          scopes: noScopes ? [] : [scopes.portfolioRead],
          userId,
          userSettings: { baseCurrency }
        };

        return true;
      }
    });
}

// Builds the app the same way main.ts does: /api prefix and URI versioning
// with v1 as the default, so tests call the real public URLs.
export async function createE2eApp(
  builder: TestingModuleBuilder
): Promise<INestApplication> {
  const app = (await builder.compile()).createNestApplication();

  app.enableVersioning({ defaultVersion: '1', type: VersioningType.URI });
  app.setGlobalPrefix('api');

  await app.init();

  return app;
}
