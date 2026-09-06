import { createFileRoute } from '@tanstack/react-router'
import { SETTINGS_SECTIONS, type SettingsSection } from '@/lib/routes'

function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === 'string' && (SETTINGS_SECTIONS as readonly string[]).includes(value)
}

export const Route = createFileRoute('/settings')({
  validateSearch: (search: Record<string, unknown>) => ({
    section: isSettingsSection(search.section) ? search.section : undefined,
  }),
})
