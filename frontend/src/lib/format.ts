const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const timeFmt = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

export const localTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function formatDateTime(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatRange(startIso: string, endIso: string): string {
  return `${dateFmt.format(new Date(startIso))} – ${timeFmt.format(new Date(endIso))}`;
}

/** <input type="datetime-local"> value (local wall time) -> UTC ISO string. */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}
