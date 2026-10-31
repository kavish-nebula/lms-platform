/** Display instants consistently in Indian Standard Time, independently of the browser timezone. */
export const DISPLAY_TIME_ZONE = "Asia/Kolkata";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function formatIst(value: string | Date): string {
  return `${dateTime.format(new Date(value))} IST`;
}
