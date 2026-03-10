export function formatMinutesToHoursMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes === 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function parseHoursMinutesToMinutes(timeString: string): number {
  const hourMatch = timeString.match(/(\d+)\s*h/i);
  const minuteMatch = timeString.match(/(\d+)\s*m/i);

  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;

  return hours * 60 + minutes;
}

export function formatMinutesInputValue(minutes: number | null): string {
  if (!minutes) return '';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
