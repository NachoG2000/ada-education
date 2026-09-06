import { CheckIcon, LogOutIcon, PlusIcon, SettingsIcon, UserPlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useHostedWorkspace } from './hosted-context'

export function CommunityRail() {
  const hosted = useHostedWorkspace()
  if (hosted.communities.length < 2) return null

  return (
    <aside className="hidden w-12 shrink-0 flex-col items-center border-r bg-background py-2 md:flex" aria-label="Communities">
      <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-1">
        {hosted.communities.map((community) => {
          const active = community.id === hosted.activeCommunity.id
          const button = (
            <button
              type="button"
              onClick={() => hosted.switchCommunity(community.id)}
              aria-current={active ? 'page' : undefined}
              aria-label={`${community.name}, ${community.term}`}
              className={cn(
                'relative flex size-9 shrink-0 items-center justify-center rounded-md border text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted',
              )}
            >
              {community.initial}
            </button>
          )
          return (
            <ContextMenu key={community.id}>
              <Tooltip>
                <ContextMenuTrigger render={<TooltipTrigger render={button} />} />
                <TooltipContent side="right"><span className="font-medium">{community.name}</span><span className="ml-1 text-muted-foreground">{community.term}</span></TooltipContent>
              </Tooltip>
              <ContextMenuContent>
                <ContextMenuGroup>
                  <ContextMenuItem onClick={() => hosted.switchCommunity(community.id)}><CheckIcon />Open community</ContextMenuItem>
                  {community.membership.role === 'teacher' ? <ContextMenuItem onClick={() => hosted.switchCommunity(community.id, 'settings')}><SettingsIcon />Community settings</ContextMenuItem> : null}
                  {community.membership.role === 'teacher' ? <ContextMenuItem onClick={() => hosted.switchCommunity(community.id, 'invite')}><UserPlusIcon />Invite people</ContextMenuItem> : null}
                </ContextMenuGroup>
                <ContextMenuSeparator />
                <ContextMenuGroup><ContextMenuItem variant="destructive" disabled={active && !hosted.canLeaveCommunity} title={active ? hosted.leaveCommunityBlockedReason : undefined} onClick={() => hosted.switchCommunity(community.id, 'leave')}><LogOutIcon />Leave community</ContextMenuItem></ContextMenuGroup>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
      </div>
      <Separator className="my-2 w-7" />
      <Tooltip>
        <TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" onClick={hosted.requestAddCommunity} aria-label="Add a community" />}><PlusIcon /></TooltipTrigger>
        <TooltipContent side="right">Add a community</TooltipContent>
      </Tooltip>
    </aside>
  )
}
