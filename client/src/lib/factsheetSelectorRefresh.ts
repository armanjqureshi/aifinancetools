export function refreshDownloadedFactsheetSelector(input: {
  invalidateRecent: () => unknown;
  invalidateAmcs: () => unknown;
}) {
  return Promise.all([
    Promise.resolve(input.invalidateRecent()),
    Promise.resolve(input.invalidateAmcs()),
  ]);
}
