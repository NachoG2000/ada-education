import { BookOpenIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function AdaMark({ className }: { className?: string }) {
  return <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground", className)}><BookOpenIcon className="size-1/2" aria-hidden /></span>
}

export function AdaWelcome() {
  return <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-10 text-center"><div className="max-w-md"><AdaMark className="mx-auto size-16 rounded-2xl" /><h2 className="mt-5 text-2xl font-semibold tracking-tight">Hi, I’m Ada.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">A little space to think things through. Ask a question, unpack a course concept, or work through an example with me.</p><p className="mt-5 text-xs leading-5 text-muted-foreground">Bring a message here with “Ask Ada” to explore it outside the channel.</p></div></div>
}
