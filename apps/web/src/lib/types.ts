/* Re-export: the domain model lives in packages/protocol (shared with the
   server and the runner). This file exists so we don't break the SPA's
   historical `@/lib/types` imports. */
export * from "@ada/protocol"
