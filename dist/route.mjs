export const MAX_ROUTE_BYTES = 2_500_000;

const ACTIONS = new Set(['north', 'depart', 'straight', 'left', 'right', 'bear-left', 'bear-right', 'roundabout', 'return', 'finish']);
const isRecord = x => x != null && typeof x === 'object' && !Array.isArray(x);
const numberIn = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;

function word(x, max, label) {
  if (typeof x !== 'string' || !x.trim() || x.length > max) throw new Error(`Invalid ${label} in the route file.`);
  return x.trim();
}

function quantity(x, limit, label) {
  if (!numberIn(x, 0, limit) || !Number.isInteger(x)) throw new Error(`Invalid ${label} in a route step.`);
  return x;
}

export function isPoint(x) {
  return Array.isArray(x) && x.length === 2 && numberIn(x[0], -85, 85) && numberIn(x[1], -180, 180);
}

function readMap(value) {
  if (!isRecord(value)) throw new Error('Invalid route map.');
  const { image, width, height } = value;
  if (typeof image !== 'string' || image.length > MAX_ROUTE_BYTES ||
      !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image) ||
      !Number.isInteger(width) || !numberIn(width, 32, 5000) ||
      !Number.isInteger(height) || !numberIn(height, 32, 5000)) {
    throw new Error('Invalid route map image.');
  }
  let bounds = null;
  if (value.bounds != null) {
    const { north, south, east, west } = value.bounds;
    if (!isPoint([north, west]) || !isPoint([south, east]) || north <= south || east <= west) {
      throw new Error('Invalid route map bounds.');
    }
    bounds = { north, south, east, west };
  }
  return { image, width, height, bounds, attribution: value.attribution === 'packet-road-references' || value.attribution === true };
}

export function parseRoute(input) {
  let doc = input;
  if (typeof input === 'string') {
    if (input.length > MAX_ROUTE_BYTES) throw new Error('This route file is too large.');
    try { doc = JSON.parse(input); } catch { throw new Error('Choose a valid Route Scout JSON file.'); }
  }
  if (!isRecord(doc) || doc.version !== 1 || !Array.isArray(doc.steps) || !doc.steps.length || doc.steps.length > 1000) {
    throw new Error('Choose a Route Scout file with at least one ordered step.');
  }
  const steps = doc.steps.map((step, i) => {
    if (!isRecord(step) || step.id !== i + 1 || !ACTIONS.has(step.action) || !numberIn(step.miles, 0, 500) ||
        (step.waypoint != null && !isPoint(step.waypoint)) ||
        ('service' in step && typeof step.service !== 'boolean') ||
        ('manual' in step && typeof step.manual !== 'boolean') ||
        (step.details != null && (!Array.isArray(step.details) || step.details.length > 16))) {
      throw new Error(`Invalid or out-of-order route step ${i + 1}.`);
    }
    return {
      id: step.id,
      action: step.action,
      title: word(step.title, 140, 'step title'),
      source: word(step.source, 2400, 'step direction'),
      details: (step.details ?? []).map(x => word(x, 360, 'step note')),
      miles: step.miles,
      stops: quantity(step.stops, 1000, 'stop count'),
      regular: quantity(step.regular, 10000, 'regular box count'),
      centralized: quantity(step.centralized, 10000, 'centralized box count'),
      service: step.service === true,
      manual: step.manual === true,
      waypoint: step.waypoint?.slice() ?? null,
    };
  });
  if (doc.miles != null && !numberIn(doc.miles, 0, 5000)) throw new Error('Invalid route mileage.');
  return {
    version: 1,
    id: word(doc.id, 60, 'route ID'),
    name: word(doc.name, 100, 'route name'),
    area: word(doc.area, 100, 'route area'),
    effective: doc.effective == null || doc.effective === '' ? '' : word(doc.effective, 40, 'route date'),
    miles: doc.miles ?? Math.round(100 * steps.reduce((sum, step) => sum + step.miles, 0)) / 100,
    map: doc.map == null ? null : readMap(doc.map),
    steps,
  };
}

export function routeTotals(route) {
  return route.steps.reduce((totals, step) => {
    totals.stops += step.stops;
    totals.regular += step.regular;
    totals.centralized += step.centralized;
    return totals;
  }, { steps: route.steps.length, miles: route.miles, stops: 0, regular: 0, centralized: 0 });
}

export function serviceRequired(step) {
  return Boolean(step && (step.service || step.stops > 0 || step.regular > 0 || step.centralized > 0));
}

export function moveCursor(route, index, event, target) {
  const count = route.steps.length;
  const at = Number.isInteger(index) ? Math.max(0, Math.min(count, index)) : 0;
  if (event === 'next') return Math.min(at + 1, count);
  if (event === 'previous') return Math.max(at - 1, 0);
  if (event === 'jump' && Number.isInteger(target) && target >= 0 && target < count) return target;
  if (event === 'reset') return 0;
  return at;
}

export function findSteps(route, input, stopsOnly = false) {
  const text = input.trim().toLowerCase();
  const exact = text.match(/^#?(\d+)$/);
  return route.steps.filter(step => {
    if (stopsOnly && !serviceRequired(step)) return false;
    if (exact && Number(exact[1]) === step.id) return true;
    if (text.startsWith('#')) return false;
    const haystack = [step.title, step.source, ...step.details].join(' ').toLowerCase();
    return text.split(/\s+/).every(w => haystack.includes(w));
  });
}

export function formatMiles(x) {
  return `${x.toFixed(2).replace(/\.?0+$/, '')} mi`;
}
