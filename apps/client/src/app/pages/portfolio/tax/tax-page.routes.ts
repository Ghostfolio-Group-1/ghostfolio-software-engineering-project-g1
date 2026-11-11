import { AuthGuard } from '@ghostfolio/client/core/auth.guard';

import { Routes } from '@angular/router';

import { GfTaxPageComponent } from './tax-page.component';

export const routes: Routes = [
  {
    canActivate: [AuthGuard],
    component: GfTaxPageComponent,
    path: '',
    title: $localize`Tax analytics`
  }
];
