import { fifoActivitiesSchema } from './fifo-activity.schema';

export const fifoRealizedGainActivitiesSchema = {
  ...fifoActivitiesSchema,
  $id: 'fifo-realized-gain-activities',
  items: {
    ...fifoActivitiesSchema.items,
    required: [...fifoActivitiesSchema.items.required, 'fee'],
    properties: {
      ...fifoActivitiesSchema.items.properties,
      fee: { type: 'number', minimum: 0 }
    }
  }
};
