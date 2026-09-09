import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/c/$communityId/channels/$channelId')({
  validateSearch: (search: Record<string, unknown>): { artifact?: string } => ({ artifact: typeof search.artifact === "string" && search.artifact.length <= 200 ? search.artifact : undefined }),
})
