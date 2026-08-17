/**
 * Pins the whole run to a time zone that observes daylight saving, so the
 * scheduling tests exercise DST transitions rather than accidentally running
 * in UTC. This has to happen before the worker processes start, which is why
 * it lives in `globalSetup` instead of the per-file setup.
 */
export default async function globalSetup(): Promise<void> {
  process.env.TZ = 'America/New_York';
}
