/**
 * Client-side ticket activity tracking (localStorage-based).
 *
 * - recentlyChanged: a ticket was edited/commented on; shown as a blue dot in
 *   all ticket lists and cleared when the ticket is opened.
 * - unseen: a ticket was (re-)assigned to a user who hasn't opened it yet;
 *   shown as "New" grey text in ticket lists and cleared when the assignee
 *   opens the ticket.
 */

const CHANGED_KEY = 'overlord.recentlyChanged'
const UNSEEN_KEY = 'overlord.unseenTickets'

// ── recently-changed helpers ─────────────────────────────────────────────────

function readChangedMap(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(CHANGED_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function writeChangedMap(map: Record<string, number>) {
  localStorage.setItem(CHANGED_KEY, JSON.stringify(map))
}

/** Mark a ticket as recently changed (call on every mutation success). */
export function markTicketChanged(ticketId: string) {
  if (typeof window === 'undefined') return
  const map = readChangedMap()
  map[ticketId] = Date.now()
  writeChangedMap(map)
  window.dispatchEvent(new CustomEvent('ticket-activity-changed', { detail: { ticketId } }))
}

/** Clear the recently-changed flag (call when the ticket detail page mounts). */
export function clearTicketChanged(ticketId: string) {
  if (typeof window === 'undefined') return
  const map = readChangedMap()
  if (ticketId in map) {
    delete map[ticketId]
    writeChangedMap(map)
    window.dispatchEvent(new CustomEvent('ticket-activity-changed', { detail: { ticketId } }))
  }
}

/** Returns true if the ticket has been recently changed and not yet opened. */
export function isTicketChanged(ticketId: string): boolean {
  return ticketId in readChangedMap()
}

// ── unseen helpers ───────────────────────────────────────────────────────────

function readUnseenMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(UNSEEN_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function writeUnseenMap(map: Record<string, string>) {
  localStorage.setItem(UNSEEN_KEY, JSON.stringify(map))
}

/**
 * Mark a ticket as unseen for a given assignee.
 * Call this in `updateMutation.onSuccess` when `assigneeId` is in the patch.
 */
export function markTicketUnseen(ticketId: string, assigneeId: string) {
  if (typeof window === 'undefined') return
  const map = readUnseenMap()
  map[ticketId] = assigneeId
  writeUnseenMap(map)
  window.dispatchEvent(new CustomEvent('ticket-activity-changed', { detail: { ticketId } }))
}

/**
 * Clear the unseen flag for a ticket.
 * Call this when the ticket detail page mounts and the current user is the assignee.
 */
export function clearTicketUnseen(ticketId: string) {
  if (typeof window === 'undefined') return
  const map = readUnseenMap()
  if (ticketId in map) {
    delete map[ticketId]
    writeUnseenMap(map)
    window.dispatchEvent(new CustomEvent('ticket-activity-changed', { detail: { ticketId } }))
  }
}

/**
 * Returns true if the ticket is unseen for the given user id.
 * A ticket is "unseen" when it was assigned to `userId` and not yet opened.
 */
export function isTicketUnseen(ticketId: string, userId: string): boolean {
  const map = readUnseenMap()
  return map[ticketId] === userId
}
