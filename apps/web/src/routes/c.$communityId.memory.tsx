import { createFileRoute } from '@tanstack/react-router'
import { parseMemorySearch } from '@/lib/memory-route'
export const Route = createFileRoute('/c/$communityId/memory')({
  validateSearch: parseMemorySearch,
})
