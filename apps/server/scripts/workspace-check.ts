/**
 * Complete, fast workspace-capability check. Each imported slice owns a
 * throwaway database/course and throws on its first failed invariant.
 */
await import("./workspace-migration-check.js")
await import("./workspace-channels-check.js")
await import("./workspace-members-messages-check.js")
await import("./workspace-attachments-check.js")
await import("./workspace-api-check.js")
await import("./workspace-ws-check.js")

console.log("\nWorkspace capability OK")
