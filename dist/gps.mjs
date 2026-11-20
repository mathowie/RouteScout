import { isPoint, serviceRequired } from './route.mjs';

const radians = x => x * Math.PI / 180;
const mercator = lat => Math.log(Math.tan(Math.PI / 4 + radians(lat) / 2));
export const MAX_FIX_AGE = 30_000;
export const MAP_ACCURACY = 90;
const ASSIST_ACCURACY = 24;
const ENTER_METERS = 31;
const ARRIVE_METERS = 26;
const MAX_ASSIST_GAP = 60_000;

export function projectPoint(bounds, point, width, height) {
  if (!bounds || !isPoint(point)) return null;
  const [lat, lon] = point;
  const x = width * (lon - bounds.west) / (bounds.east - bounds.west);
  const top = mercator(bounds.north);
  const y = height * (top - mercator(lat)) / (top - mercator(bounds.south));
  return { x, y, inside: lat <= bounds.north && lat >= bounds.south && lon >= bounds.west && lon <= bounds.east };
}

export function distanceMeters(a, b) {
  if (!isPoint(a) || !isPoint(b)) return Infinity;
  const dLat = radians(b[0] - a[0]);
  const dLon = radians(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(dLon / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function normalizeFix(position) {
  const { coords, timestamp } = position ?? {};
  const point = [coords?.latitude, coords?.longitude];
  if (!isPoint(point) || !Number.isFinite(coords.accuracy) || coords.accuracy <= 0 || !Number.isFinite(timestamp)) return null;
  return { point, accuracy: coords.accuracy, time: timestamp };
}

export function usableFix(fix, now = Date.now()) {
  return Boolean(fix && isPoint(fix.point) && Number.isFinite(fix.accuracy) && fix.accuracy > 0 &&
    fix.accuracy <= MAP_ACCURACY && Number.isFinite(fix.time) && now - fix.time <= MAX_FIX_AGE && fix.time <= now + 5000);
}

export function freshFix(fix, prior, now = Date.now()) {
  return Boolean(fix && fix.time >= now - MAX_FIX_AGE &&
    fix.time <= now + 5000 && (!prior || fix.time > prior.time));
}

export function assistEligible(step, next) {
  return Boolean(step?.waypoint && next?.waypoint && !step.manual && !next.manual && !serviceRequired(step) &&
    distanceMeters(step.waypoint, next.waypoint) >= 70 && distanceMeters(step.waypoint, next.waypoint) < 3000);
}

export function newAssist() {
  return { entered: false, seenAt: null, approachAt: null, advance: false };
}

export function updateAssist(state, step, next, fix, now = Date.now()) {
  if (!assistEligible(step, next) || !usableFix(fix, now) || fix.accuracy > ASSIST_ACCURACY) {
    return { ...state, approachAt: null, advance: false };
  }
  if (state.seenAt != null && fix.time <= state.seenAt) return { ...state, advance: false };
  if (state.seenAt != null && fix.time - state.seenAt > MAX_ASSIST_GAP) state = newAssist();

  const from = distanceMeters(fix.point, step.waypoint);
  const to = distanceMeters(fix.point, next.waypoint);
  const entered = state.entered || from <= ENTER_METERS;
  const onApproach = entered && to <= ARRIVE_METERS && from > ENTER_METERS;
  const elapsed = state.approachAt == null ? 0 : fix.time - state.approachAt;
  const advance = onApproach && elapsed >= 750 && elapsed <= 10_000;

  return {
    entered,
    seenAt: fix.time,
    approachAt: onApproach ? (elapsed && elapsed < 750 ? state.approachAt : fix.time) : null,
    advance,
  };
}

export function formatDistance(meters) {
  if (meters >= 800) return `${(meters / 1609.344).toFixed(1)} mi`;
  return `${Math.max(10, Math.round(meters * 3.28084 / 10) * 10)} ft`;
}
