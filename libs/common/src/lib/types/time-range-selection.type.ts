export const TIME_RANGE_PRESETS = [
  'today',
  'wtd',
  'mtd',
  'ytd',
  '1y',
  '5y',
  'max'
] as const;

export type TimeRangePreset = (typeof TIME_RANGE_PRESETS)[number];

export type TimeRangeSelection =
  | {
      mode: 'preset';
      preset: TimeRangePreset;
    }
  | {
      mode: 'custom';
      startDate: string;
      endDate: string;
    };
