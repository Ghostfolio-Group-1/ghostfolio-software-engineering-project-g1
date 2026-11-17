const genericActivitySaveError = $localize`Could not save activity.`;

export function activitySaveErrorMessage(error: {
  error?: { message?: unknown };
  status?: number;
}): string {
  // Validation responses (4xx) are safe to show. 5xx bodies can include
  // internal details, so those stay on the generic fallback.
  if (typeof error?.status === 'number' && error.status >= 500) {
    return genericActivitySaveError;
  }

  const message = error?.error?.message;

  if (Array.isArray(message)) {
    return message.join(' ');
  }

  return typeof message === 'string' && message
    ? message
    : genericActivitySaveError;
}
