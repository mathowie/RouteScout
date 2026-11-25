import { moveCursor } from './route.mjs';

export function normalizePosition(route, position) {
  const index = Number.isInteger(position?.index) ? Math.max(0, Math.min(route.steps.length, position.index)) : 0;
  const count = route.steps[index]?.mailboxes?.length ?? 0;
  const mailboxIndex = Number.isInteger(position?.mailboxIndex) && position.mailboxIndex >= 0 && position.mailboxIndex < count
    ? position.mailboxIndex : 0;
  return { index, mailboxIndex };
}

export function moveGuidance(route, position, event, target) {
  const current = normalizePosition(route, position);
  const count = route.steps[current.index]?.mailboxes?.length ?? 0;
  if (event === 'next' && current.mailboxIndex + 1 < count) {
    return { index: current.index, mailboxIndex: current.mailboxIndex + 1 };
  }
  if (event === 'previous' && current.mailboxIndex > 0) {
    return { index: current.index, mailboxIndex: current.mailboxIndex - 1 };
  }
  const index = moveCursor(route, current.index, event, target);
  const validJump = event === 'jump' && Number.isInteger(target) && target >= 0 && target < route.steps.length;
  if (index === current.index && event !== 'reset' && !validJump) return current;
  const previousCount = route.steps[index]?.mailboxes?.length ?? 0;
  return { index, mailboxIndex: event === 'previous' ? Math.max(0, previousCount - 1) : 0 };
}

export function mailboxLabel(mailbox, index) {
  return mailbox?.label || `Mailbox ${index + 1}`;
}

export function sequenceLabel(mailbox) {
  const range = mailbox?.sequence;
  if (!range) return 'Sequence not provided';
  return range.start === range.end ? `Sequence ${range.start}` : `Sequence ${range.start}–${range.end}`;
}

export function mailboxReminder(mailbox, index, count) {
  const label = mailbox?.label && !/^Mailbox \d+$/.test(mailbox.label) ? mailbox.label : '';
  const location = count > 1 ? `Mailbox ${index + 1} of ${count}${label ? `, ${label}` : ''}.`
    : label ? `Service the mailbox at ${label}.` : 'Service the mailbox there.';
  const range = mailbox?.sequence;
  const reminder = !range ? 'Check the van for packages. No sequence range is provided for this mailbox.'
    : range.start === range.end ? `Check the van for packages with sequence number ${range.start}.`
      : `Check the van for packages with sequence numbers ${range.start} through ${range.end}.`;
  return `${location} ${reminder}`;
}
