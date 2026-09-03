import type { ApiErrorCode } from "@ada/protocol"

const HTTP_STATUS: Record<ApiErrorCode, number> = {
  invalid_input: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  not_channel_member: 403,
  channel_archived: 409,
  conflict: 409,
  history_conflict: 409,
}

/** Typed failures shared by the workspace access and channel services.
    API handlers can serialize `code`, `field`, and `status` without parsing
    human-facing error strings. */
export class WorkspaceError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly field?: string

  constructor(code: ApiErrorCode, message: string, field?: string) {
    super(message)
    this.name = "WorkspaceError"
    this.code = code
    this.status = HTTP_STATUS[code]
    this.field = field
  }
}

export function workspaceError(code: ApiErrorCode, message: string, field?: string): WorkspaceError {
  return new WorkspaceError(code, message, field)
}
