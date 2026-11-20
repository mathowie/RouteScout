import { distanceMeters, projectPoint } from './gps.mjs';

const NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function marker(color, ring = false) {
  const group = svg('g', { display: 'none' });
  if (ring) group.append(svg('circle', { r: 18, fill: color, 'fill-opacity': .2 }));
  const pin = svg('circle', { r: 8, fill: color, stroke: '#fff', 'stroke-width': 2.5 });
  group.append(pin);
  return group;
}

export function createRouteMap({ viewport, canvas, empty, controls, plus, minus, fit, center }) {
  let map = null;
  let stepPoint = null;
  let gpsPoint = null;
  let stepMarker = null;
  let gpsMarker = null;
  let drag = null;
  let follow = false;
  let zoom = 1;
  let x, y;

  function position(marker, p) {
    const visible = Boolean(p?.inside);
    marker.setAttribute('display', visible ? '' : 'none');
    if (!visible) return;
    marker.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${1 / Math.sqrt(zoom)})`);
  }

  function placeMarkers() {
    if (!map) return;
    position(stepMarker, stepPoint);
    position(gpsMarker, gpsPoint);
  }

  function applyView() {
    if (!map) return;
    const { width, height } = map;
    const w = width / zoom;
    const h = height / zoom;
    x = Math.max(w / 2, Math.min(width - w / 2, x));
    y = Math.max(h / 2, Math.min(height - h / 2, y));
    canvas.setAttribute('viewBox', `${x - w / 2} ${y - h / 2} ${w} ${h}`);
    viewport.dataset.zoomed = String(zoom > 1);
    plus.disabled = zoom >= 7;
    minus.disabled = zoom <= 1;
    center.disabled = !stepPoint?.inside && !gpsPoint?.inside;
    center.setAttribute('aria-pressed', String(follow));
    placeMarkers();
  }

  function focusPoint() {
    return gpsPoint?.inside ? gpsPoint : stepPoint?.inside ? stepPoint : null;
  }

  function fitMap() {
    if (!map) return;
    zoom = 1; follow = false;
    x = map.width / 2; y = map.height / 2;
    applyView();
  }

  plus.addEventListener('click', () => {
    if (!map) return;
    const p = focusPoint();
    if (zoom === 1 && p) { x = p.x; y = p.y; }
    zoom = Math.min(7, zoom * 1.55);
    applyView();
  });
  minus.addEventListener('click', () => {
    if (!map) return;
    zoom = Math.max(1, zoom / 1.55);
    if (zoom === 1) follow = false;
    applyView();
  });
  fit.addEventListener('click', fitMap);
  center.addEventListener('click', () => {
    const p = focusPoint();
    if (!p) return;
    x = p.x; y = p.y; zoom = Math.max(zoom, 2.5); follow = true;
    applyView();
  });

  canvas.addEventListener('pointerdown', event => {
    if (!map || zoom <= 1 || drag || event.button !== 0) return;
    const { width, height } = canvas.getBoundingClientRect();
    const scale = Math.min(width / map.width, height / map.height) * zoom;
    if (!scale) return;
    drag = { id: event.pointerId, x, y, px: event.clientX, py: event.clientY, scale };
    canvas.setPointerCapture(event.pointerId);
    viewport.dataset.dragging = 'true';
  });
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    follow = false;
    x = drag.x - (event.clientX - drag.px) / drag.scale;
    y = drag.y - (event.clientY - drag.py) / drag.scale;
    applyView();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, event => {
      if (drag?.id !== event.pointerId) return;
      delete viewport.dataset.dragging;
      drag = null;
    });
  }

  return {
    setMap(nextMap) {
      map = nextMap;
      stepPoint = gpsPoint = drag = null;
      delete viewport.dataset.dragging;
      delete viewport.dataset.zoomed;
      canvas.replaceChildren();
      empty.textContent = 'No map in this route file';
      canvas.hidden = !map;
      controls.hidden = !map;
      empty.hidden = Boolean(map);
      if (!map) return;
      const photo = svg('image', {
        width: map.width, height: map.height, href: map.image, preserveAspectRatio: 'none',
      });
      photo.addEventListener('error', () => {
        empty.textContent = 'Route map image could not be opened';
        empty.hidden = false;
        controls.hidden = true;
      });
      stepMarker = marker('#2356df');
      gpsMarker = marker('#127d67', true);
      gpsMarker.setAttribute('data-marker', 'location');
      canvas.append(photo, stepMarker, gpsMarker);
      fitMap();
    },

    setMarkers(step, fix, allowFix) {
      if (!map) return { location: false, step: false };
      stepPoint = projectPoint(map.bounds, step?.waypoint, map.width, map.height);
      gpsPoint = allowFix ? projectPoint(map.bounds, fix?.point, map.width, map.height) : null;
      const p = follow && focusPoint();
      if (p) { x = p.x; y = p.y; }
      applyView();
      return { location: Boolean(gpsPoint?.inside), step: Boolean(stepPoint?.inside) };
    },
  };
}

export function distanceFromStep(fix, step) {
  if (!fix || !step?.waypoint) return null;
  return distanceMeters(fix.point, step.waypoint);
}
