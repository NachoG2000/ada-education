import {
  browserAuthFrameSchema,
  browserServerFrameSchema,
  activeAgentSchema,
  activeMembershipSchema,
  agentEnrollmentResultSchema,
  agentDmSchema,
  communityChannelSchema,
  communitySummarySchema,
  rotateAgentEnrollmentResultSchema,
  communityWorkspaceSnapshotSchema,
  createCommunityResultSchema,
  createUserResultSchema,
  deletedAgentSchema,
  inviteCreateResultSchema,
  inviteListResultSchema,
  inviteRedeemResultSchema,
  inviteRevokeResultSchema,
  messageTombstoneSchema,
  publicDirectorySchema,
  scopedMessageSchema,
  scopedThreadSchema,
  sessionOverviewSchema,
  updateUserResultSchema,
  type CommunityMember,
  type CommunityWorkspaceSnapshot,
  type CreateCommunityAgentInput,
  type CreateCommunityChannelInput,
  type CreateCommunityInput,
  type CreateInviteInput,
  type CreateScopedMessageInput,
  type CreateScopedThreadInput,
  type EditScopedMessageInput,
  type UpdateMembershipRoleInput,
  type UpdateCommunityChannelInput,
  type UpdateUserInput,
  type ScopedServerEvent,
} from "@ada/protocol";
import { scopedServerEventSchema } from "@ada/protocol";

export type MembershipRole = "teacher" | "student";

export type HostedMember = CommunityMember;
export type HostedSnapshot = CommunityWorkspaceSnapshot;

export class HostedApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "HostedApiError";
  }
}

const jsonHeaders = (token?: string) => ({
  "content-type": "application/json",
  ...(token ? { authorization: `Bearer ${token}` } : {}),
});

export async function request<T>(
  server: string,
  path: string,
  token: string | undefined,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${server}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(15_000),
      headers: { ...(init.body instanceof FormData ? (token ? { authorization: `Bearer ${token}` } : {}) : jsonHeaders(token)), ...(init.headers ?? {}) },
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw new HostedApiError(
        "The server took too long to respond. Try again.",
      );
    }
    throw new HostedApiError(
      "The server is unavailable. Check that Ada is running and try again.",
    );
  }
  if (!response.ok) {
    let message = `The server returned ${response.status}.`;
    let code: string | undefined;
    try {
      const body = (await response.json()) as {
        error?: unknown;
        message?: unknown;
        code?: unknown;
      };
      if (typeof body.error === "string") message = body.error;
      else if (typeof body.message === "string") message = body.message;
      if (typeof body.code === "string") code = body.code;
    } catch {
      /* retain fallback */
    }
    throw new HostedApiError(message, response.status, code);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const path = (value: string) => encodeURIComponent(value);
const communityPath = (communityId: string, suffix = "") =>
  `/api/communities/${path(communityId)}${suffix}`;

export const createUser = (server: string, displayName: string) =>
  request<unknown>(server, "/api/users", undefined, {
    method: "POST",
    body: JSON.stringify({ displayName }),
  }).then((result) => createUserResultSchema.parse(result));
export const restoreSession = (server: string, token: string) =>
  request<unknown>(server, "/api/session", token).then((result) =>
    sessionOverviewSchema.parse(result),
  );
export const updateUser = (
  server: string,
  token: string,
  input: UpdateUserInput,
) =>
  request<unknown>(server, "/api/users/me", token, {
    method: "PATCH",
    body: JSON.stringify(input),
  }).then((result) => updateUserResultSchema.parse(result));
export const createCommunity = (
  server: string,
  token: string,
  input: CreateCommunityInput,
) =>
  request<unknown>(server, "/api/communities", token, {
    method: "POST",
    body: JSON.stringify(input),
  }).then((result) => createCommunityResultSchema.parse(result));
export const updateCommunity = (
  server: string,
  token: string,
  communityId: string,
  input: { name?: string; term?: string },
) =>
  request<unknown>(server, communityPath(communityId), token, {
    method: "PATCH",
    body: JSON.stringify(input),
  }).then((result) => communitySummarySchema.parse(result));
export const redeemInvite = (server: string, token: string, code: string) =>
  request<unknown>(server, "/api/invites/redeem", token, {
    method: "POST",
    body: JSON.stringify({ code }),
  }).then((result) => inviteRedeemResultSchema.parse(result));
export const fetchSnapshot = (
  server: string,
  token: string,
  communityId: string,
) =>
  request<unknown>(server, communityPath(communityId), token).then((result) =>
    communityWorkspaceSnapshotSchema.parse(result),
  );
export const fetchDirectory = (
  server: string,
  token: string,
  communityId: string,
) =>
  request<unknown>(
    server,
    communityPath(communityId, "/directory"),
    token,
  ).then((result) => publicDirectorySchema.parse(result));
export const createInvite = (
  server: string,
  token: string,
  communityId: string,
  input: CreateInviteInput,
) =>
  request<unknown>(server, communityPath(communityId, "/invites"), token, {
    method: "POST",
    body: JSON.stringify(input),
  }).then((result) => inviteCreateResultSchema.parse(result));
export const listInvites = (
  server: string,
  token: string,
  communityId: string,
) =>
  request<unknown>(server, communityPath(communityId, "/invites"), token).then(
    (result) => inviteListResultSchema.parse(result),
  );
export const revokeInvite = (
  server: string,
  token: string,
  communityId: string,
  inviteId: string,
) =>
  request<unknown>(
    server,
    communityPath(communityId, `/invites/${path(inviteId)}`),
    token,
    { method: "DELETE" },
  ).then((result) => inviteRevokeResultSchema.parse(result));
export const updateMembershipRole = (
  server: string,
  token: string,
  communityId: string,
  userId: string,
  input: UpdateMembershipRoleInput,
) =>
  request<unknown>(
    server,
    communityPath(communityId, `/members/${path(userId)}`),
    token,
    { method: "PATCH", body: JSON.stringify(input) },
  ).then((result) => activeMembershipSchema.parse(result));
export const removeMember = (
  server: string,
  token: string,
  communityId: string,
  userId: string,
) =>
  request<unknown>(
    server,
    communityPath(communityId, `/members/${path(userId)}`),
    token,
    { method: "DELETE" },
  );
export const leaveCommunity = (
  server: string,
  token: string,
  communityId: string,
) =>
  request<unknown>(server, communityPath(communityId, "/membership"), token, {
    method: "DELETE",
  });
export const createChannel = (
  server: string,
  token: string,
  communityId: string,
  input: CreateCommunityChannelInput,
) =>
  request<unknown>(
    server,
    communityPath(communityId, "/channels"),
    token,
    { method: "POST", body: JSON.stringify(input) },
  ).then((result) => communityChannelSchema.parse(result));
export const updateChannel = (
  server: string,
  token: string,
  communityId: string,
  channelId: string,
  input: UpdateCommunityChannelInput,
) =>
  request<unknown>(
    server,
    communityPath(communityId, `/channels/${path(channelId)}`),
    token,
    { method: "PATCH", body: JSON.stringify(input) },
  ).then((result) => communityChannelSchema.parse(result));
export const joinChannel = (
  server: string,
  token: string,
  communityId: string,
  channelId: string,
) =>
  request<unknown>(
    server,
    communityPath(communityId, `/channels/${path(channelId)}/join`),
    token,
    { method: "POST", body: JSON.stringify({}) },
  ).then((result) => communityChannelSchema.parse(result));
export const leaveChannel = (
  server: string,
  token: string,
  communityId: string,
  channelId: string,
) =>
  request<unknown>(
    server,
    communityPath(communityId, `/channels/${path(channelId)}/leave`),
    token,
    { method: "DELETE" },
  ).then((result) => communityChannelSchema.parse(result));
export const createDm = (
  server: string,
  token: string,
  communityId: string,
  agentId: string,
) =>
  request<unknown>(
    server,
    communityPath(communityId, "/dms"),
    token,
    {
      method: "POST",
      body: JSON.stringify({ agentId }),
    },
  ).then((result) => {
    if (!result || typeof result !== "object") {
      throw new HostedApiError("The server returned an invalid DM.");
    }
    const body = result as { channel?: unknown; dm?: unknown };
    agentDmSchema.parse(body.dm);
    return communityChannelSchema.parse(body.channel);
  });
export const createAgent = (
  server: string,
  token: string,
  communityId: string,
  input: CreateCommunityAgentInput,
) =>
  request<unknown>(server, communityPath(communityId, "/agents"), token, {
    method: "POST",
    body: JSON.stringify(input),
  }).then((result) => agentEnrollmentResultSchema.parse(result));
export const updateAgent = (
  server: string,
  token: string,
  communityId: string,
  agentId: string,
  input: Record<string, unknown>,
) =>
  request<unknown>(
    server,
    communityPath(communityId, `/agents/${path(agentId)}`),
    token,
    { method: "PATCH", body: JSON.stringify(input) },
  ).then((result) => activeAgentSchema.parse(result));
export const deleteAgent = (
  server: string,
  token: string,
  communityId: string,
  agentId: string,
) =>
  request<unknown>(
    server,
    communityPath(communityId, `/agents/${path(agentId)}`),
    token,
    { method: "DELETE" },
  ).then((result) => deletedAgentSchema.parse(result));
export const rotateAgent = (
  server: string,
  token: string,
  communityId: string,
  agentId: string,
) =>
  request<unknown>(
    server,
    communityPath(communityId, `/agents/${path(agentId)}/enrollment`),
    token,
    { method: "POST", body: JSON.stringify({}) },
  ).then((result) => rotateAgentEnrollmentResultSchema.parse(result));
export const createMessage = (
  server: string,
  token: string,
  communityId: string,
  input: CreateScopedMessageInput,
) =>
  request<unknown>(
    server,
    communityPath(communityId, `/channels/${path(input.channelId)}/messages`),
    token,
    { method: "POST", body: JSON.stringify(input) },
  ).then((result) => scopedMessageSchema.parse(result));
export const editMessage = (
  server: string,
  token: string,
  communityId: string,
  messageId: string,
  input: EditScopedMessageInput,
) =>
  request<unknown>(
    server,
    communityPath(communityId, `/messages/${path(messageId)}`),
    token,
    { method: "PATCH", body: JSON.stringify(input) },
  ).then((result) => scopedMessageSchema.parse(result));
export const deleteMessage = (
  server: string,
  token: string,
  communityId: string,
  messageId: string,
) =>
  request<unknown>(
    server,
    communityPath(communityId, `/messages/${path(messageId)}`),
    token,
    { method: "DELETE", body: JSON.stringify({}) },
  ).then((result) => messageTombstoneSchema.parse(result));
export const createThread = (
  server: string,
  token: string,
  communityId: string,
  input: CreateScopedThreadInput,
) =>
  request<unknown>(server, communityPath(communityId, "/threads"), token, {
    method: "POST",
    body: JSON.stringify(input),
  }).then((result) => scopedThreadSchema.parse(result));

export function connectHostedEvents(
  server: string,
  token: string,
  communityId: string,
  onEvent: (event: ScopedServerEvent) => void,
  onStatus: (connected: boolean) => void,
): { close: () => void } {
  const url = new URL(`${server.replace(/^http/, "ws")}/ws`);
  let socket: WebSocket | undefined;
  let closed = false;
  let retry = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const open = () => {
    if (closed) return;
    socket = new WebSocket(url);
    socket.onopen = () => {
      retry = 0;
      // communityId is part of the hosted browser auth frame. Keep the cast
      // narrow while the shared schema is being updated by the protocol worker.
      const authFrame = { type: "auth", token, communityId };
      socket?.send(JSON.stringify(browserAuthFrameSchema.parse(authFrame)));
    };
    socket.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const frame = browserServerFrameSchema.safeParse(parsed);
      if (frame.success && frame.data.type === "ready") {
        if (frame.data.payload.communityId === communityId) onStatus(true);
      } else if (frame.success && frame.data.type === "event") {
        const eventResult = scopedServerEventSchema.safeParse(
          frame.data.payload.event,
        );
        if (eventResult.success && eventResult.data.communityId === communityId)
          onEvent(eventResult.data);
      }
    };
    socket.onclose = () => {
      if (closed) return;
      onStatus(false);
      timer = setTimeout(open, Math.min(1000 * 2 ** retry++, 15_000));
    };
    socket.onerror = () => onStatus(false);
  };
  open();
  return {
    close: () => {
      closed = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    },
  };
}
