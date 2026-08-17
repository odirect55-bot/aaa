/**
 * Collision-resistant enough for device-local records: a monotonic timestamp
 * prefix plus randomness. Avoids pulling in a uuid dependency.
 */
export function createId(prefix = 'alarm'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${timestamp}${random}`;
}
