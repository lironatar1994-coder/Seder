export interface GoogleEventDTO {
  id: string; title: string; calendar: string; startAt: string; endAt: string;
  startDay: string; endDay: string; allDay: boolean; htmlLink: string | null; location: string | null;
}
export interface GoogleSettingsDTO {
  accountEmail: string; showEvents: boolean;
  lastSyncAt: string | null; lastError: string | null;
  sources: { id: string; name: string; enabled: boolean }[];
}
