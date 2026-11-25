# Mailbox sequence package reminders

The carrier wants the range of delivery sequence numbers at each physical mailbox or mailbox cluster so packages with those numbers are not left in the van. Their final choice is one mailbox at a time, replacing the earlier idea of speaking all ranges for a route step together.

## Behavior

- The current mailbox shows its optional location label, position within the step, and prominent delivery sequence range.
- Spoken guidance includes only the selected mailbox's range: “Check the van for packages with sequence numbers 680 through 712.” A single sequence number uses the singular. Unknown ranges are identified without inventing numbers.
- Next confirms one mailbox, then presents and announces the next mailbox. The step advances only after its last mailbox. Back, Repeat, step selection, restart, and saved progress respect the mailbox position.
- Turn instructions are spoken when entering a step and when requested with Repeat. Moving between mailboxes within the same step speaks the mailbox reminder without repeating the turn.
- Existing files without mailbox data retain their current whole-step behavior. Delivery steps remain excluded from GPS auto-advance.

## Data

Optional version 1 step field `mailboxes` is an ordered array of at most 1,000 objects. Each has an optional nonblank `label` of at most 140 UTF-16 code units and an optional `sequence` object with integer `start` and `end`, inclusive, each 1–999,999 and `end >= start`. Omitted or null sequence means unknown. Omitted or null mailboxes means no per-mailbox guidance.

A nonempty array requires a service step. If the existing `stops` count is positive, the array must contain exactly that many entries; unknown ranges can use an entry with `sequence: null`. If the source stop count is zero/unspecified but service is explicitly marked or box counts are positive, the explicit array defines the available mailbox prompts without changing source totals. Preserve author order and allow repeated ranges for retraces. Never infer a range from box counts, turn-order numbers, or adjacency.

The current native iPhone app may import the file while ignoring the optional mailbox metadata; this change targets web display and spoken guidance. Personal sequence data stays in imported files and browser storage, outside public Git or hosting.

## Implementation choice

Use `mailboxes` under each existing instruction rather than splitting source instructions or adding a route-wide address database. This preserves source distances and counts. Pure navigation/formatting helpers make nested progress and speech independently testable.

The available Line of Travel tables have instruction order/count columns. The carrier has been asked which PDF/page holds the actual delivery sequence ranges; real routes must not be populated with made-up ranges. Public examples are fictional.
