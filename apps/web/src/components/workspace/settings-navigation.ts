import { CommandIcon, LogOutIcon, SettingsIcon, UserIcon, UserPlusIcon, UsersIcon, type LucideIcon } from "lucide-react"
import type { SettingsSection } from "@/lib/routes"

type Section = { section: SettingsSection; label: string; icon: LucideIcon }
export function settingsSections(teacher: boolean): Section[] {
  return [
    { section: "profile", label: "Profile", icon: UserIcon },
    ...(teacher ? [
      { section: "community" as const, label: "Community", icon: SettingsIcon },
      { section: "members" as const, label: "Members", icon: UsersIcon },
      { section: "invites" as const, label: "Invites", icon: UserPlusIcon },
    ] : []),
    { section: "shortcuts", label: "Keyboard shortcuts", icon: CommandIcon },
    { section: "account", label: "Account", icon: LogOutIcon },
  ]
}
