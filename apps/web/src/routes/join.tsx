import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/join')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : undefined,
  }),
})
