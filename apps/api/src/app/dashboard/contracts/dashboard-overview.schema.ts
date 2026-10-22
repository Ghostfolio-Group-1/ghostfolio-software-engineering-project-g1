// JSON Schema for GET /api/v1/dashboard/overview (DashboardOverviewResponse in
// the shared envelope). Tax and charts section data reuse their endpoint
// contracts so the dashboard cannot drift from them.
import { chartSeriesResponseSchema } from '../../charts/contracts/chart-series.schema';
import { taxRealizedGainsResponseSchema } from '../../tax/contracts/tax-realized-gains.schema';

const unavailableSection = {
  type: 'object',
  additionalProperties: false,
  required: ['error', 'status'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', pattern: '^DASHBOARD_[A-Z]+_UNAVAILABLE$' },
        message: { type: 'string', minLength: 1 }
      }
    },
    status: { const: 'unavailable' }
  }
};

const section = (data: object) => {
  return {
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['data', 'status'],
        properties: { data, status: { const: 'available' } }
      },
      unavailableSection
    ]
  };
};

export const dashboardOverviewResponseSchema = {
  $id: 'dashboard-overview-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['charts', 'risk', 'tax'],
      properties: {
        charts: section(chartSeriesResponseSchema.properties.data),
        risk: section({ type: 'object' }),
        tax: section(taxRealizedGainsResponseSchema.properties.data)
      }
    },
    error: { type: 'null' },
    meta: { type: 'object' }
  }
};

export const dashboardErrorResponseSchema = {
  $id: 'dashboard-error-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: { type: 'null' },
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', pattern: '^DASHBOARD_[A-Z_]+$' },
        message: { type: 'string', minLength: 1 }
      }
    },
    meta: { type: 'object' }
  }
};
