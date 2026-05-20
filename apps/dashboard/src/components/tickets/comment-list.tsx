import { formatRelativeTime } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Comment } from '@platform/shared-types'

interface CommentListProps {
  comments: Comment[]
  currentUserId?: string
  onDelete?: (id: string) => void
}

/** Split text on URLs and render them as clickable links */
function renderWithLinks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline break-all hover:opacity-80"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      part
    ),
  )
}

export function CommentList({ comments, currentUserId, onDelete }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No comments yet. Be the first to comment.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const initials = comment.author.name
          ?.split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)

        return (
          <div key={comment.id} className="flex gap-3">
            <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
              <AvatarImage src={comment.author.image ?? undefined} />
              <AvatarFallback className="text-xs">{initials ?? '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">
                  {comment.author.name ?? comment.author.email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(comment.createdAt)}
                </span>
              </div>
              <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">
                {renderWithLinks(comment.content)}
              </p>
              {onDelete && currentUserId === comment.authorId && (
                <button
                  type="button"
                  onClick={() => onDelete(comment.id)}
                  className="text-xs text-muted-foreground hover:text-destructive mt-1 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
