// This re-exports the Prisma client after running `prisma generate`.
// Run `pnpm db:generate` from the workspace root to generate the client.
export { PrismaClient, Prisma } from '@prisma/client'
export type {
  User,
  Account,
  VerificationToken,
  Project,
  Ticket,
  Comment,
  Label,
  TicketLabel,
  Service,
  ApiController,
  ApiEndpoint,
  ApiIngestionEvent,
  ProjectStatus,
  TicketStatus,
  TicketPriority,
  ServiceStatus,
} from '@prisma/client'
