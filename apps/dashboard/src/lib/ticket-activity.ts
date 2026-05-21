/**
 * Client-side ticket activity tracking (localStorage-based).
 *
 * - unseen: a ticket was (re-)assigned to a user who hasn't opened it yet;
 *   shown as "assigned" text in ticket lists and cleared when the assignee
 *   opens the ticket.
 */

const UNSEEN_KEY = 'overlord.unseenTickets'

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
