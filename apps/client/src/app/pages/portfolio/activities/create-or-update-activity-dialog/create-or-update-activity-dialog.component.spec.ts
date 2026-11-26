import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';
import { CreateOrderDto, UpdateOrderDto } from '@ghostfolio/common/dtos';
import { DataService } from '@ghostfolio/ui/services';

import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import 'reflect-metadata';
import { of } from 'rxjs';

import { CreateOrUpdateActivityDialogParams } from './interfaces/interfaces';

jest.mock('@ionic/angular/standalone', () => ({
  IonIcon: class IonIcon {}
}));

jest.mock('@ghostfolio/ui/account-selector', () => ({
  GfAccountSelectorComponent: class GfAccountSelectorComponent {}
}));

jest.mock('@ghostfolio/ui/i18n', () => ({
  translate: (value: string) => value
}));

jest.mock('@ghostfolio/ui/services', () => ({
  DataService: class DataService {}
}));

jest.mock('@ghostfolio/ui/symbol-autocomplete', () => ({
  GfSymbolAutocompleteComponent: class GfSymbolAutocompleteComponent {}
}));

jest.mock('@ghostfolio/ui/tags-selector', () => ({
  GfTagsSelectorComponent: class GfTagsSelectorComponent {}
}));

jest.mock('@ghostfolio/ui/value', () => ({
  GfValueComponent: class GfValueComponent {}
}));

jest.mock('@ghostfolio/client/services/user/user.service', () => ({
  UserService: class UserService {}
}));

jest.mock('@ghostfolio/client/services/impersonation-storage.service', () => ({
  ImpersonationStorageService: class ImpersonationStorageService {}
}));

const { GfCreateOrUpdateActivityDialogComponent } =
  require('./create-or-update-activity-dialog.component') as typeof import('./create-or-update-activity-dialog.component');

type Activity = CreateOrUpdateActivityDialogParams['activity'];

const dividendDate = new Date('2026-03-15T00:00:00.000Z');

function dividendActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    accountId: 'account-1',
    assetProfile: {
      currency: 'USD',
      dataSource: 'YAHOO',
      name: 'Microsoft',
      symbol: 'MSFT'
    },
    comment: null,
    currency: 'USD',
    date: dividendDate,
    fee: 0,
    id: null,
    quantity: 10,
    tags: [],
    type: 'DIVIDEND',
    unitPrice: 2,
    withholdingTax: null,
    ...overrides
  } as Activity;
}

describe('GfCreateOrUpdateActivityDialogComponent', () => {
  let close: jest.Mock;
  let fixture: ComponentFixture<
    InstanceType<typeof GfCreateOrUpdateActivityDialogComponent>
  >;

  async function setup(activity: Activity) {
    close = jest.fn();

    const data: CreateOrUpdateActivityDialogParams = {
      accounts: [{ currency: 'USD', id: 'account-1' } as never],
      activity,
      user: {
        id: 'user-1',
        permissions: [],
        settings: { baseCurrency: 'USD', locale: 'en-US' },
        tags: []
      } as never
    };

    await TestBed.configureTestingModule({
      imports: [GfCreateOrUpdateActivityDialogComponent, ReactiveFormsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: DataService,
          useValue: {
            fetchInfo: () => ({ currencies: ['USD'] }),
            fetchPortfolioHoldings: () => of({ holdings: [] }),
            fetchSymbolItem: () =>
              of({ currency: 'USD', dataSource: 'YAHOO', marketPrice: 2 })
          }
        },
        { provide: DateAdapter, useValue: { setLocale: jest.fn() } },
        { provide: MAT_DATE_LOCALE, useValue: 'en-US' },
        {
          provide: ChangeDetectorRef,
          useValue: { markForCheck: jest.fn() }
        },
        {
          provide: ImpersonationStorageService,
          useValue: { getId: () => null }
        },
        { provide: UserService, useValue: {} }
      ]
    })
      .overrideComponent(GfCreateOrUpdateActivityDialogComponent, {
        set: { imports: [], template: '' }
      })
      .compileComponents();

    fixture = TestBed.createComponent(GfCreateOrUpdateActivityDialogComponent);
    fixture.detectChanges();

    return fixture.componentInstance;
  }

  afterEach(() => {
    fixture?.destroy();
  });

  function formOf(
    component: InstanceType<typeof GfCreateOrUpdateActivityDialogComponent>
  ) {
    return component['activityForm'];
  }

  async function submit(
    component: InstanceType<typeof GfCreateOrUpdateActivityDialogComponent>
  ) {
    await component['onSubmit']();
  }

  it('rejects withholding above quantity × unitPrice and allows an empty amount', async () => {
    const component = await setup(dividendActivity());
    const withholding = formOf(component).get('withholdingTax');

    withholding?.setValue(20.01);

    expect(withholding?.hasError('withholdingExceedsGross')).toBe(true);
    expect(formOf(component).valid).toBe(false);

    withholding?.setValue(null);

    expect(withholding?.errors).toBeNull();

    withholding?.setValue('');

    expect(withholding?.errors).toBeNull();
    expect(formOf(component).valid).toBe(true);
  });

  it('sends withholdingTax only for a dividend and clears it when the type changes', async () => {
    const component = await setup(dividendActivity({ withholdingTax: 1.5 }));

    await submit(component);

    expect(close).toHaveBeenCalledTimes(1);
    const dividend = close.mock.calls[0][0] as CreateOrderDto;

    expect(dividend.type).toBe('DIVIDEND');
    expect(dividend.withholdingTax).toBe(1.5);

    close.mockClear();
    formOf(component).get('withholdingTax')?.setValue('');

    await submit(component);

    expect(
      (close.mock.calls[0][0] as CreateOrderDto).withholdingTax
    ).toBeNull();

    close.mockClear();
    formOf(component).get('type')?.setValue('BUY');

    expect(formOf(component).get('withholdingTax')?.value).toBeNull();

    await submit(component);

    const buy = close.mock.calls[0][0] as CreateOrderDto;

    expect(buy.type).toBe('BUY');
    expect(buy).not.toHaveProperty('withholdingTax');
  });

  it('sends the disabled type and an ISO date when updating an activity', async () => {
    const component = await setup(
      dividendActivity({ id: 'activity-1', withholdingTax: 0.6 })
    );
    const form = formOf(component);

    expect(form.get('type')?.disabled).toBe(true);

    await submit(component);

    const update = close.mock.calls[0][0] as UpdateOrderDto;

    expect(update.id).toBe('activity-1');
    expect(update.type).toBe('DIVIDEND');
    expect(update.date).toBe(dividendDate.toISOString());
    expect(update.withholdingTax).toBe(0.6);
  });
});
