/**
 * Dynamic Time-of-Day Greeting and User Profile Utilities for AralSync
 */

export function getTimeOfDayGreeting(language: 'en' | 'tl' = 'en'): string {
  const hour = new Date().getHours();
  if (language === 'tl') {
    if (hour < 12) return 'Magandang umaga';
    if (hour < 18) return 'Magandang hapon';
    return 'Magandang gabi';
  }
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function getUserInitials(name?: string): string {
  if (!name || !name.trim()) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
