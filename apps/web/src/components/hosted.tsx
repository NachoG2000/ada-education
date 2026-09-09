import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Hash,
  Users,
  Bot,
  Plus,
  LogOut,
  Copy,
  Pencil,
  Trash2,
  MessageSquare,
  UserPlus,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  createAgent,
  createChannel,
  createCommunity,
  createDm,
  createInvite,
  createMessage,
  createThread,
  deleteAgent,
  deleteMessage,
  editMessage,
  fetchSnapshot,
  joinChannel,
  leaveCommunity,
  leaveChannel,
  redeemInvite,
  removeMember,
  rotateAgent,
  updateChannel,
  updateAgent,
  type HostedSnapshot,
  connectHostedEvents,
  HostedApiError,
} from "@/lib/hosted-api";
import type {
  ActiveAgent,
  CommunityChannel,
  CommunitySummary,
  InviteCreateResult,
  ScopedMessage,
  ScopedServerEvent,
  ScopedThread,
  User,
} from "@ada/protocol";
import { createUser, restoreSession } from "@/lib/hosted-api";
import { clearToken, readStoredToken, storeToken } from "@/lib/auth";
import { HostedWorkspaceSurface } from "@/components/hosted-surface";
import { useAppNavigation, useAppRoute } from "@/lib/routes";

type Phase =
  "loading" | "account" | "sign-in" | "credential" | "onboarding" | "workspace";
type Session = { user: User; token: string; communities: CommunitySummary[] };
type ReducibleHostedEvent =
  | {
      type: "channel.created" | "channel.updated" | "channel.archived";
      payload: { channel: CommunityChannel };
    }
  | { type: "channel.deleted"; payload: { channelId: string } }
  | {
      type: "agent.created" | "agent.updated";
      payload: { agent: ActiveAgent };
    }
  | { type: "agent.deleted"; payload: { agent: { id: string } } }
  | {
      type: "message.created" | "message.updated";
      payload: { message: ScopedMessage };
    }
  | {
      type: "message.deleted";
      payload: {
        message: { id: string; deletedAt: string; deletedBy: string };
      };
    }
  | {
      type: "thread.created" | "thread.updated";
      payload: { thread: ScopedThread };
    }
  | {
      type: "runner.presence";
      payload: {
        agentId: string;
        presence: "online" | "offline" | "thinking" | "publishing";
        runtime: "claude" | "codex" | "pi";
        model?: string;
      };
    };

const threadOverlayQuery = "(max-width: 1023px)";
const subscribeToThreadOverlay = (listener: () => void) => {
  const media = window.matchMedia(threadOverlayQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
const readThreadOverlay = () => window.matchMedia(threadOverlayQuery).matches;

export function HostedApp({ server }: { server: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string>();
  const [newToken, setNewToken] = useState<string>();

  const load = useCallback(async () => {
    setPhase("loading");
    setError(undefined);
    const token = readStoredToken();
    if (!token) {
      setPhase("account");
      return;
    }
    try {
      const restored = await restoreSession(server, token);
      setSession({
        user: restored.user,
        token,
        communities: restored.communities ?? [],
      });
      setPhase("workspace");
    } catch (cause) {
      const invalidCredential = cause instanceof HostedApiError && (cause.status === 401 || cause.status === 403);
      if (invalidCredential) {
        clearToken();
        setSession(null);
        setError("That saved session is no longer valid. Create an account or paste a user token.");
        setPhase("account");
      } else {
        setError(cause instanceof Error ? cause.message : "Ada could not restore this session.");
        setPhase("loading");
      }
    }
  }, [server]);
  useEffect(() => {
    // Session restoration synchronizes React with local storage and the API.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const create = async (displayName: string) => {
    const result = await createUser(server, displayName);
    storeToken(result.token);
    setSession({ user: result.user, token: result.token, communities: [] });
    setNewToken(result.token);
    setPhase("credential");
  };
  const restore = async (token: string) => {
    const result = await restoreSession(server, token);
    storeToken(token);
    setSession({
      user: result.user,
      token,
      communities: result.communities ?? [],
    });
    setPhase("workspace");
  };
  if (phase === "loading")
    return (
      <Startup
        title={error ? "Ada is temporarily unavailable" : "Connecting to Ada…"}
        detail={error ?? "Restoring your account securely."}
      >
        {error ? <Button className="mt-5 w-full" onClick={() => void load()}>Retry</Button> : null}
      </Startup>
    );
  if (phase === "account")
    return (
      <AccountGate
        error={error}
        onCreate={create}
        onSignIn={() => {
          setError(undefined);
          setPhase("sign-in");
        }}
      />
    );
  if (phase === "sign-in")
    return (
      <SignInGate
        error={error}
        onBack={() => setPhase("account")}
        onSignIn={restore}
      />
    );
  if (phase === "credential" && newToken && session)
    return (
      <CredentialStep
        token={newToken}
        onContinue={() => setPhase("workspace")}
      />
    );
  if (!session) return null;
  return (
    <HostedSession
      server={server}
      initial={session}
      onSignOut={() => {
        clearToken();
        setSession(null);
        setPhase("account");
      }}
    />
  );
}

function CredentialStep({
  token,
  onContinue,
}: {
  token: string;
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };
  return (
    <Startup
      title="Save your user token"
      detail="It is shown once. Keep it somewhere safe to restore this account on another device."
    >
      <div className="mt-5 space-y-3">
        <code className="block break-all rounded-md border bg-muted p-3 text-xs">
          {token}
        </code>
        <Button
          className="w-full"
          variant="outline"
          onClick={() => void copy()}
        >
          {copied ? "Copied" : "Copy token"}
        </Button>
        <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
          <Checkbox
            checked={saved}
            onCheckedChange={(checked) => setSaved(checked === true)}
            aria-label="I saved this token somewhere safe"
          />
          <span>I saved this token somewhere safe</span>
        </label>
        <Button className="w-full" disabled={!saved} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </Startup>
  );
}

function Startup({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-7">
        <p className="text-sm font-medium">{title}</p>
        {detail ? (
          <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        ) : null}
        {children}
      </div>
    </main>
  );
}

function AccountGate({
  error,
  onCreate,
  onSignIn,
}: {
  error?: string;
  onCreate: (name: string) => Promise<void>;
  onSignIn: () => void;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const submit = async () => {
    if (!name.trim()) {
      setFormError("Enter a display name.");
      return;
    }
    setPending(true);
    setFormError(undefined);
    try {
      await onCreate(name.trim());
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : "Account creation failed.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Startup
      title="Welcome to Ada"
      detail="Create a local account with a display name. Your account token stays only in this browser."
    >
      <div className="mt-6 space-y-3">
        <label className="block text-sm font-medium" htmlFor="display-name">
          Display name
        </label>
        <Input
          id="display-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          placeholder="Your name"
        />
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => void submit()}
        >
          {pending ? "Creating…" : "Create account"}
        </Button>
        {formError || error ? (
          <p className="text-sm text-destructive" role="alert">
            {formError ?? error}
          </p>
        ) : null}
        <Button variant="ghost" className="w-full" onClick={onSignIn}>
          Restore with a user token
        </Button>
      </div>
    </Startup>
  );
}

function SignInGate({
  error,
  onBack,
  onSignIn,
}: {
  error?: string;
  onBack: () => void;
  onSignIn: (token: string) => Promise<void>;
}) {
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const submit = async () => {
    if (token.trim().length < 20) {
      setFormError("Paste the complete user token.");
      return;
    }
    setPending(true);
    setFormError(undefined);
    try {
      await onSignIn(token.trim());
    } catch (cause) {
      setFormError(
        cause instanceof Error
          ? cause.message
          : "Could not restore this account.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Startup
      title="Restore your account"
      detail="Paste the high-entropy user token from another Ada browser."
    >
      <div className="mt-6 space-y-3">
        <label className="block text-sm font-medium" htmlFor="user-token">
          User token
        </label>
        <Input
          id="user-token"
          autoFocus
          value={token}
          onChange={(event) => setToken(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          placeholder="Paste token"
          type="password"
        />
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => void submit()}
        >
          {pending ? "Restoring…" : "Restore account"}
        </Button>
        {formError || error ? (
          <p className="text-sm text-destructive" role="alert">
            {formError ?? error}
          </p>
        ) : null}
        <Button variant="ghost" className="w-full" onClick={onBack}>
          Back
        </Button>
      </div>
    </Startup>
  );
}

function HostedSession({
  server,
  initial,
  onSignOut,
}: {
  server: string;
  initial: Session;
  onSignOut: () => void;
}) {
  const route = useAppRoute();
  const navigateTo = useAppNavigation();
  const [user, setUser] = useState(initial.user);
  const [communities, setCommunities] = useState(initial.communities);
  const [activeId, setActiveId] = useState<string | undefined>(() => {
    const routedCommunityId = "communityId" in route ? route.communityId : undefined;
    if (
      routedCommunityId &&
      initial.communities.some((community) => community.id === routedCommunityId)
    ) return routedCommunityId;
    try {
      const stored = localStorage.getItem("ada:community");
      return stored &&
        initial.communities.some((community) => community.id === stored)
        ? stored
        : initial.communities[0]?.id;
    } catch {
      return initial.communities[0]?.id;
    }
  });
  const [snapshot, setSnapshot] = useState<HostedSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [pendingCommunityAction, setPendingCommunityAction] = useState<
    "invite" | "leave" | undefined
  >();
  const [onboarding, setOnboarding] = useState(
    initial.communities.length === 0,
  );
  const loadSequence = useRef(0);
  const activeIdRef = useRef(activeId);
  const active = communities.find((community) => community.id === activeId);
  const activate = useCallback((id: string | undefined) => {
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  const refreshCommunities = useCallback(async () => {
    const result = await restoreSession(server, initial.token);
    setCommunities(result.communities ?? []);
    return result.communities ?? [];
  }, [initial.token, server]);
  const loadCommunity = useCallback(
    async (communityId: string) => {
      const sequence = ++loadSequence.current;
      setSnapshot(null);
      setLoadError(undefined);
      try {
        const next = await fetchSnapshot(server, initial.token, communityId);
        if (
          sequence !== loadSequence.current ||
          communityId !== activeIdRef.current
        )
          return;
        setSnapshot(next);
        try {
          localStorage.setItem("ada:community", communityId);
        } catch {
          /* optional preference */
        }
      } catch (cause) {
        if (sequence !== loadSequence.current) return;
        setLoadError(
          cause instanceof Error
            ? cause.message
            : "Could not load this community.",
        );
      }
    },
    [initial.token, server],
  );
  useEffect(() => {
    // The selected tenant is an external API resource and must be hydrated.
    // oxlint-disable-next-line react/set-state-in-effect
    if (activeId) void loadCommunity(activeId);
  }, [activeId, loadCommunity]);
  const create = async (name: string, term: string) => {
    setPending(true);
    try {
      const result = await createCommunity(server, initial.token, {
        starterAgents: true,
        name,
        term,
      });
      const next = await refreshCommunities();
      setCommunities(next);
      activate(result.community.id);
      setOnboarding(false);
      return result.community;
    } finally {
      setPending(false);
    }
  };
  const redeem = async (code: string) => {
    setPending(true);
    try {
      const result = await redeemInvite(server, initial.token, code);
      const next = await refreshCommunities();
      setCommunities(next);
      activate(result.community.id);
      setOnboarding(false);
      return result;
    } finally {
      setPending(false);
    }
  };
  const leaveActiveCommunity = async () => {
    if (!activeId) return;
    await leaveCommunity(server, initial.token, activeId);
    const next = await refreshCommunities();
    setCommunities(next);
    setSnapshot(null);
    if (next.length) {
      activate(next[0].id);
      setOnboarding(false);
    } else {
      activate(undefined);
      setOnboarding(true);
    }
  };
  const refreshWorkspace = useCallback(async () => {
    const requestedId = activeIdRef.current;
    const next = await refreshCommunities();
    setCommunities(next);
    if (requestedId !== activeIdRef.current) return;
    if (
      requestedId &&
      next.some((community) => community.id === requestedId)
    ) {
      await loadCommunity(requestedId);
    } else {
      setSnapshot(null);
      activate(next[0]?.id);
    }
  }, [activate, loadCommunity, refreshCommunities]);
  const acceptSnapshot = useCallback((next: HostedSnapshot) => {
    if (next.community.id === activeIdRef.current) setSnapshot(next);
  }, []);
  if (onboarding)
    return (
      <Onboarding
        pending={pending}
        onCreate={async (name, term) => {
          const community = await create(name, term);
          await navigateTo({ kind: "inbox", communityId: community.id }, { replace: true });
        }}
        onRedeem={async (code) => {
          const result = await redeem(code);
          await navigateTo({ kind: "inbox", communityId: result.community.id }, { replace: true });
        }}
        onSignOut={onSignOut}
        onCancel={communities.length ? () => setOnboarding(false) : undefined}
      />
    );
  if (!active)
    return (
      <Onboarding
        pending={pending}
        onCreate={async (name, term) => {
          const community = await create(name, term);
          await navigateTo({ kind: "inbox", communityId: community.id }, { replace: true });
        }}
        onRedeem={async (code) => {
          const result = await redeem(code);
          await navigateTo({ kind: "inbox", communityId: result.community.id }, { replace: true });
        }}
        onSignOut={onSignOut}
        onCancel={communities.length ? () => setOnboarding(false) : undefined}
      />
    );
  return (
    <HostedWorkspaceSurface
      key={active.id}
      server={server}
      token={initial.token}
      user={user}
      communities={communities}
      active={active}
      snapshot={snapshot}
      pendingCommunityAction={pendingCommunityAction}
      onPendingCommunityActionHandled={() => setPendingCommunityAction(undefined)}
      error={loadError}
      onRetry={() => void loadCommunity(active.id)}
      onSwitch={(id, action) => {
        setSnapshot(null);
        setPendingCommunityAction(action);
        activate(id);
      }}
      onCommunities={refreshWorkspace}
      onSnapshot={acceptSnapshot}
      onUser={setUser}
      onCreateCommunity={({ name, term }) => create(name, term)}
      onRedeemInvite={redeem}
      onLeaveCommunity={leaveActiveCommunity}
      onSignOut={onSignOut}
    />
  );
}

function Onboarding({
  pending,
  onCreate,
  onRedeem,
  onSignOut,
  onCancel,
}: {
  pending: boolean;
  onCreate: (name: string, term: string) => Promise<void>;
  onRedeem: (code: string) => Promise<void>;
  onSignOut: () => void;
  onCancel?: () => void;
}) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [term, setTerm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const submit = async () => {
    setError(undefined);
    try {
      if (tab === "create") await onCreate(name, term);
      else await onRedeem(code);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not complete onboarding.",
      );
    }
  };
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-lg border bg-card p-7">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">Choose your workspace</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a community or join one with an invite code.
            </p>
          </div>
          <div className="flex gap-1">
            {onCancel ? (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button
            variant={tab === "create" ? "default" : "outline"}
            onClick={() => setTab("create")}
          >
            Create community
          </Button>
          <Button
            variant={tab === "join" ? "default" : "outline"}
            onClick={() => setTab("join")}
          >
            Join with code
          </Button>
        </div>
        {tab === "create" ? (
          <div className="mt-5 space-y-3">
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Community name"
            />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Term or cohort (for example Fall 2026)"
            />
          </div>
        ) : (
          <Input
            className="mt-5"
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Paste invite code"
          />
        )}
        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          className="mt-5 w-full"
          disabled={pending}
          onClick={() => void submit()}
        >
          {pending
            ? "Working…"
            : tab === "create"
              ? "Create community"
              : "Join community"}
        </Button>
      </div>
    </main>
  );
}

export function HostedWorkspace({
  server,
  token,
  user,
  communities,
  active,
  snapshot,
  error,
  onRetry,
  onSwitch,
  onCommunities,
  onSnapshot,
  onAddCommunity,
  onLeaveCommunity,
  onSignOut,
}: {
  server: string;
  token: string;
  user: User;
  communities: CommunitySummary[];
  active: CommunitySummary;
  snapshot: HostedSnapshot | null;
  error?: string;
  onRetry: () => void;
  onSwitch: (id: string) => void;
  onCommunities: () => Promise<void>;
  onSnapshot: (snapshot: HostedSnapshot) => void;
  onAddCommunity: () => void;
  onLeaveCommunity: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<"channels" | "members">("channels");
  const [manageAgent, setManageAgent] = useState<ActiveAgent | "new">();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);
  useEffect(() => {
    const connection = connectHostedEvents(
      server,
      token,
      active.id,
      (event) => {
        if (event.communityId !== active.id) return;
        if (
          [
            "community.updated",
            "membership.created",
            "membership.updated",
            "membership.removed",
            "membership.left",
            "directory.updated",
            "agent.dm.created",
            "agent.dm.deleted",
          ].includes(event.type)
        ) {
          if (event.type.startsWith("membership.")) {
            void onCommunities().catch(() => undefined);
          } else {
            void fetchSnapshot(server, token, active.id)
              .then(onSnapshot)
              .catch(() => undefined);
          }
          return;
        }
        const current = snapshotRef.current;
        if (current) onSnapshot(reduceHostedEvent(current, event));
      },
      (ready) => {
        if (!ready) {
          setConnected(false);
          return;
        }
        setConnected(false);
        void fetchSnapshot(server, token, active.id)
          .then((next) => {
            onSnapshot(next);
            setConnected(true);
          })
          .catch((cause) => {
            setConnected(false);
            setNotice(
              cause instanceof Error
                ? `Live connection returned, but resync failed: ${cause.message}`
                : "Live connection returned, but resync failed.",
            );
          });
      },
    );
    return () => connection.close();
  }, [active.id, onCommunities, onSnapshot, server, token]);
  const channel =
    snapshot?.channels.find((item) => item.id === selected) ??
    snapshot?.channels.find(
      (item) => item.kind === "channel" && item.status === "active",
    );
  if (error)
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6">
        <div className="max-w-sm rounded-xl border bg-card p-7">
          <h1 className="font-semibold">Couldn’t load {active.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-5" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </main>
    );
  if (!snapshot)
    return (
      <Startup
        title={`Loading ${active.name}…`}
        detail="Fetching only this community’s channels and conversation."
      />
    );
  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <CommunityRail
        communities={communities}
        active={active}
        onSwitch={onSwitch}
        onAdd={onAddCommunity}
        onSignOut={onSignOut}
      />
      <aside className="hidden w-64 shrink-0 border-r bg-muted/20 p-3 md:flex md:flex-col">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground">
            {active.initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{active.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {active.term} · {snapshot.membership.role}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-1">
          <Button
            size="sm"
            variant={view === "channels" ? "secondary" : "ghost"}
            className="flex-1"
            onClick={() => setView("channels")}
          >
            <Hash className="mr-1 size-3.5" />
            Channels
          </Button>
          <Button
            size="sm"
            variant={view === "members" ? "secondary" : "ghost"}
            className="flex-1"
            onClick={() => setView("members")}
          >
            <Users className="mr-1 size-3.5" />
            Members
          </Button>
        </div>
        {view === "channels" ? (
          <ChannelSidebar
            server={server}
            token={token}
            snapshot={snapshot}
            user={user}
            selected={channel?.id}
            onSelect={setSelected}
            onChanged={onCommunities}
            onNotice={setNotice}
            onManageAgent={setManageAgent}
            canManageAgents={snapshot.membership.role === "teacher"}
            canManageChannels={snapshot.membership.role === "teacher"}
          />
        ) : (
          <MemberSidebar
            server={server}
            token={token}
            snapshot={snapshot}
            user={user}
            onInvite={() => setInviteOpen(true)}
            onNotice={setNotice}
            onChanged={onCommunities}
            onLeaveCommunity={onLeaveCommunity}
          />
        )}
        <div className="mt-auto border-t pt-3">
          <div className="flex items-center gap-2 px-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-medium">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm">
              {user.displayName}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Sign out"
              onClick={onSignOut}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b px-3 py-2 md:hidden">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Hash />
            Open workspace menu
          </Button>
        </div>
        {channel ? (
          <ChannelView
            key={`${active.id}:${channel.id}`}
            server={server}
            token={token}
            snapshot={snapshot}
            channel={channel}
            user={user}
            connected={connected}
            onNotice={setNotice}
            onRefresh={onCommunities}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-muted-foreground">
            Create or join a channel to start talking.
          </div>
        )}
      </main>
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-80 p-3 md:hidden">
          <SheetHeader className="px-2">
            <SheetTitle>{active.name}</SheetTitle>
            <SheetDescription>
              {active.term} · {snapshot.membership.role}
            </SheetDescription>
          </SheetHeader>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={view === "channels" ? "secondary" : "ghost"}
              className="flex-1"
              onClick={() => setView("channels")}
            >
              <Hash /> Channels
            </Button>
            <Button
              size="sm"
              variant={view === "members" ? "secondary" : "ghost"}
              className="flex-1"
              onClick={() => setView("members")}
            >
              <Users /> Members
            </Button>
          </div>
          {view === "channels" ? (
            <ChannelSidebar
              server={server}
              token={token}
              snapshot={snapshot}
              user={user}
              selected={channel?.id}
              onSelect={(id) => {
                setSelected(id);
                setMobileSidebarOpen(false);
              }}
              onChanged={onCommunities}
              onNotice={setNotice}
              onManageAgent={setManageAgent}
              canManageAgents={snapshot.membership.role === "teacher"}
              canManageChannels={snapshot.membership.role === "teacher"}
            />
          ) : (
            <MemberSidebar
              server={server}
              token={token}
              snapshot={snapshot}
              user={user}
              onInvite={() => setInviteOpen(true)}
              onNotice={setNotice}
              onChanged={onCommunities}
              onLeaveCommunity={async () => {
                await onLeaveCommunity();
                setMobileSidebarOpen(false);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
      {manageAgent ? (
        <AgentSheet
          server={server}
          token={token}
          snapshot={snapshot}
          value={manageAgent}
          onClose={() => setManageAgent(undefined)}
          onSaved={() => void onCommunities()}
          onNotice={setNotice}
        />
      ) : null}
      {inviteOpen ? (
        <InviteSheet
          server={server}
          token={token}
          communityId={active.id}
          onClose={() => setInviteOpen(false)}
          onNotice={setNotice}
        />
      ) : null}
      {notice ? (
        <div
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-card px-4 py-3 text-sm shadow-lg"
          role="status"
        >
          {notice}
          <button
            className="ml-3 underline"
            onClick={() => setNotice(undefined)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}

function reduceHostedEvent(
  snapshot: HostedSnapshot,
  event: ScopedServerEvent,
): HostedSnapshot {
  // The cross-tenant Zod refinement wraps the protocol union and prevents
  // TypeScript switch narrowing. The socket boundary already parsed it.
  const incoming = event as unknown as ReducibleHostedEvent;
  switch (incoming.type) {
    case "channel.created":
      return {
        ...snapshot,
        channels: [
          ...snapshot.channels.filter(
            (item) => item.id !== incoming.payload.channel.id,
          ),
          incoming.payload.channel,
        ],
      };
    case "channel.updated":
    case "channel.archived":
      return {
        ...snapshot,
        channels: snapshot.channels.map((item) =>
          item.id === incoming.payload.channel.id
            ? incoming.payload.channel
            : item,
        ),
      };
    case "channel.deleted":
      return {
        ...snapshot,
        channels: snapshot.channels.filter(
          (item) => item.id !== incoming.payload.channelId,
        ),
        messages: snapshot.messages.filter(
          (item) => item.channelId !== incoming.payload.channelId,
        ),
        threads: snapshot.threads.filter(
          (item) => item.channelId !== incoming.payload.channelId,
        ),
      };
    case "agent.created":
      return {
        ...snapshot,
        agents: [
          ...snapshot.agents.filter(
            (item) => item.id !== incoming.payload.agent.id,
          ),
          { ...incoming.payload.agent, presence: "offline" },
        ],
      };
    case "agent.updated": {
      const current = snapshot.agents.find(
        (item) => item.id === incoming.payload.agent.id,
      );
      return {
        ...snapshot,
        agents: snapshot.agents.map((item) =>
          item.id === incoming.payload.agent.id
            ? {
                ...incoming.payload.agent,
                presence: current?.presence ?? "offline",
              }
            : item,
        ),
      };
    }
    case "agent.deleted":
      return {
        ...snapshot,
        agents: snapshot.agents.filter(
          (item) => item.id !== incoming.payload.agent.id,
        ),
      };
    case "message.created":
      return {
        ...snapshot,
        messages: [
          ...snapshot.messages.filter(
            (item) => item.id !== incoming.payload.message.id,
          ),
          incoming.payload.message,
        ],
      };
    case "message.updated":
      return {
        ...snapshot,
        messages: snapshot.messages.map((item) =>
          item.id === incoming.payload.message.id
            ? incoming.payload.message
            : item,
        ),
      };
    case "message.deleted":
      return {
        ...snapshot,
        messages: snapshot.messages.map((item) =>
          item.id === incoming.payload.message.id
            ? {
                ...item,
                deletedAt: incoming.payload.message.deletedAt,
                deletedBy: incoming.payload.message.deletedBy,
                paragraphs: [],
              }
            : item,
        ),
      };
    case "thread.created":
      return {
        ...snapshot,
        threads: [
          ...snapshot.threads.filter(
            (item) => item.id !== incoming.payload.thread.id,
          ),
          incoming.payload.thread,
        ],
      };
    case "thread.updated":
      return {
        ...snapshot,
        threads: snapshot.threads.map((item) =>
          item.id === incoming.payload.thread.id
            ? incoming.payload.thread
            : item,
        ),
      };
    case "runner.presence":
      return {
        ...snapshot,
        agents: snapshot.agents.map((item) =>
          item.id === incoming.payload.agentId
            ? {
                ...item,
                presence: incoming.payload.presence,
                runtime: incoming.payload.runtime,
                ...(incoming.payload.model
                  ? { model: incoming.payload.model }
                  : {}),
              }
            : item,
        ),
      };
    default:
      return snapshot;
  }
}

function CommunityRail({
  communities,
  active,
  onSwitch,
  onAdd = () => undefined,
  onSignOut,
}: {
  communities: CommunitySummary[];
  active: CommunitySummary;
  onSwitch: (id: string) => void;
  onAdd?: () => void;
  onSignOut: () => void;
}) {
  return (
    <aside
      className="flex w-14 shrink-0 flex-col items-center gap-2 border-r bg-muted/40 py-3"
      aria-label="Communities"
    >
      {communities.map((community) => (
        <Button
          key={community.id}
          title={`${community.name} · ${community.membership.role}`}
          aria-label={`${community.name} · ${community.membership.role}`}
          aria-current={community.id === active.id ? "page" : undefined}
          variant={community.id === active.id ? "default" : "ghost"}
          size="icon"
          className="rounded-xl"
          onClick={() => onSwitch(community.id)}
        >
          {community.initial}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Create or join community"
        title="Create or join community"
        onClick={onAdd}
      >
        <Plus />
      </Button>
      <Button
        className="mt-auto"
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        onClick={onSignOut}
      >
        <LogOut />
      </Button>
    </aside>
  );
}

function ChannelSidebar({
  server,
  token,
  snapshot,
  user,
  selected,
  onSelect,
  onChanged,
  onNotice,
  onManageAgent,
  canManageAgents,
  canManageChannels,
}: {
  server: string;
  token: string;
  snapshot: HostedSnapshot;
  user: User;
  selected?: string;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void>;
  onNotice: (text: string) => void;
  onManageAgent: (agent: ActiveAgent | "new") => void;
  canManageAgents: boolean;
  canManageChannels: boolean;
}) {
  const [browse, setBrowse] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string>();
  const joined = snapshot.channels.filter(
    (channel) =>
      channel.kind === "channel" &&
      channel.status === "active" &&
      channel.memberIds.includes(user.id),
  );
  const dms = snapshot.channels.filter(
    (channel) =>
      channel.kind === "dm" &&
      channel.status === "active" &&
      (channel.memberIds.includes(user.id) ||
        snapshot.membership.role === "teacher"),
  );
  const available = snapshot.directory.channels.filter(
    (channel) =>
      channel.kind === "channel" &&
      channel.status === "active" &&
      !joined.some((item) => item.id === channel.id) &&
      channel.visibility === "public",
  );
  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const made = await createChannel(server, token, snapshot.community.id, {
        name: newName.trim(),
        kind: "channel",
        visibility: "public",
      });
      setNewName("");
      onSelect(made.id);
      await onChanged();
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not create channel.",
      );
    } finally {
      setCreating(false);
    }
  };
  const join = async (id: string) => {
    setJoining(id);
    try {
      await joinChannel(server, token, snapshot.community.id, id);
      await onChanged();
      onSelect(id);
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not join channel.",
      );
    } finally {
      setJoining(undefined);
    }
  };
  const list = (label: string, channels: typeof joined) => (
    <section className="mt-4">
      <div className="flex items-center justify-between px-2 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {label === "Channels" ? (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBrowse(!browse)}
            >
              Browse
            </Button>
            {canManageChannels ? (
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="Create channel"
                onClick={() => setBrowse(!browse)}
              >
                <Plus />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-1 space-y-0.5">
        {channels.map((item) => (
          <button
            key={item.id}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
              item.id === selected && "bg-accent font-medium",
            )}
            onClick={() => onSelect(item.id)}
          >
            <Hash className="size-3.5 text-muted-foreground" />
            <span className="truncate">{item.name}</span>
          </button>
        ))}
        {!channels.length ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">None yet.</p>
        ) : null}
      </div>
    </section>
  );
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {list("Channels", joined)}
      {list("Private messages", dms)}
      <section className="mt-5 border-t pt-3">
        <div className="flex items-center gap-1 px-2 text-xs font-medium text-muted-foreground">
          <Bot className="size-3.5" />
          <span>Agents</span>
          {canManageAgents ? (
            <Button
              size="icon-xs"
              variant="ghost"
              className="ml-auto"
              aria-label="Create agent"
              onClick={() => onManageAgent("new")}
            >
              <Plus />
            </Button>
          ) : null}
        </div>
        {snapshot.agents.map((agent) => (
          <AgentRow
            key={agent.id}
            agent={agent}
            onDm={async () => {
              try {
                const dm = await createDm(
                  server,
                  token,
                  snapshot.community.id,
                  agent.id,
                );
                await onChanged();
                onSelect(dm.id);
              } catch (cause) {
                onNotice(
                  cause instanceof Error ? cause.message : "Could not open DM.",
                );
              }
            }}
            onClick={async () => {
              if (canManageAgents) {
                onManageAgent(agent);
                return;
              }
              try {
                const dm = await createDm(
                  server,
                  token,
                  snapshot.community.id,
                  agent.id,
                );
                await onChanged();
                onSelect(dm.id);
              } catch (cause) {
                onNotice(
                  cause instanceof Error ? cause.message : "Could not open DM.",
                );
              }
            }}
          />
        ))}
        {!snapshot.agents.length ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            No agents yet.
          </p>
        ) : null}
      </section>
      {browse ? (
        <section className="mt-4 rounded-lg border bg-card p-2">
          <p className="text-xs font-medium">Browse public channels</p>
          {available.map((item) => (
            <div key={item.id} className="mt-2 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">
                #{item.name}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={joining === item.id}
                onClick={() => void join(item.id)}
              >
                {joining === item.id ? "Joining…" : "Join"}
              </Button>
            </div>
          ))}
          {canManageChannels ? (
            <div className="mt-3 flex gap-1">
              <Input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="New channel"
              />
              <Button
                size="icon"
                disabled={creating}
                onClick={() => void create()}
                aria-label="Create channel"
              >
                <Plus />
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function AgentRow({
  agent,
  onClick,
  onDm,
}: {
  agent: ActiveAgent & { presence?: string };
  onClick: () => void;
  onDm?: () => void;
}) {
  return (
    <div className="mt-1 flex items-center gap-1 rounded-md hover:bg-accent">
      <button
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
        onClick={onClick}
      >
        <AgentAvatar agent={agent} />
        <span className="min-w-0 flex-1 truncate">{agent.name}</span>
        <Circle
          className={cn(
            "size-2 fill-current",
            agent.presence === "online"
              ? "text-primary"
              : "text-muted-foreground",
          )}
        />
      </button>
      {onDm ? (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Message ${agent.name}`}
          onClick={onDm}
        >
          <MessageSquare />
        </Button>
      ) : null}
    </div>
  );
}

function AgentAvatar({
  agent,
  className,
}: {
  agent: Pick<ActiveAgent, "name" | "avatarUrl">;
  className?: string;
}) {
  if (agent.avatarUrl) {
    return (
      <img
        src={agent.avatarUrl}
        alt={`${agent.name} avatar`}
        className={cn(
          "size-6 shrink-0 rounded-full bg-secondary object-cover",
          className,
        )}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary",
        className,
      )}
      aria-hidden="true"
    >
      <Bot className="size-3.5" />
    </span>
  );
}

function MemberSidebar({
  server,
  token,
  snapshot,
  user,
  onInvite,
  onNotice,
  onChanged,
  onLeaveCommunity,
}: {
  server: string;
  token: string;
  snapshot: HostedSnapshot;
  user: User;
  onInvite: () => void;
  onNotice: (text: string) => void;
  onChanged: () => Promise<void>;
  onLeaveCommunity: () => Promise<void>;
}) {
  const teacher = snapshot.membership.role === "teacher";
  const [busy, setBusy] = useState<string>();
  const [leaving, setLeaving] = useState(false);
  const remove = async (id: string) => {
    setBusy(id);
    try {
      await removeMember(server, token, snapshot.community.id, id);
      onNotice("Member removed.");
      await onChanged();
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not remove member.",
      );
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mt-4 flex items-center justify-between px-2">
        <p className="text-xs font-medium text-muted-foreground">Roster</p>
        {teacher ? (
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Create invite"
            onClick={onInvite}
          >
            <UserPlus />
          </Button>
        ) : null}
      </div>
      {snapshot.members.map((member) => (
        <div key={member.id} className="mt-2 flex items-center gap-2 px-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs">
            {member.displayName.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{member.displayName}</span>
            <span className="block text-xs text-muted-foreground">
              {member.role} · {member.presence}
            </span>
          </span>
          {teacher && member.id !== user.id ? (
            <ConfirmAction
              trigger={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={busy === member.id}
                  aria-label={`Remove ${member.displayName}`}
                >
                  <Trash2 />
                </Button>
              }
              title={`Remove ${member.displayName}?`}
              description="They will lose access to this community and its channels."
              confirmLabel="Remove member"
              onConfirm={() => remove(member.id)}
            />
          ) : null}
        </div>
      ))}
      <div className="mt-6 border-t px-2 pt-3">
        <ConfirmAction
          trigger={
            <Button
              className="w-full justify-start"
              size="sm"
              variant="outline"
              disabled={leaving}
            >
              <LogOut /> Leave community
            </Button>
          }
          title="Leave this community?"
          description="You will need a new invite to return."
          confirmLabel="Leave community"
          onConfirm={async () => {
            setLeaving(true);
            try {
              await onLeaveCommunity();
            } catch (cause) {
              onNotice(
                cause instanceof Error
                  ? cause.message
                  : "Could not leave community.",
              );
              throw cause;
            } finally {
              setLeaving(false);
            }
          }}
        />
      </div>
    </div>
  );
}

function ChannelView({
  server,
  token,
  snapshot,
  channel,
  user,
  connected,
  onNotice,
  onRefresh,
}: {
  server: string;
  token: string;
  snapshot: HostedSnapshot;
  channel: CommunityChannel & { group?: string };
  user: User;
  connected: boolean;
  onNotice: (text: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [editingChannel, setEditingChannel] = useState(false);
  const [channelName, setChannelName] = useState(channel.name);
  const [channelPending, setChannelPending] = useState(false);
  const [threadId, setThreadId] = useState<string>();
  const [sending, setSending] = useState(false);
  const [threadPending, setThreadPending] = useState(false);
  const threadUsesOverlay = useSyncExternalStore(
    subscribeToThreadOverlay,
    readThreadOverlay,
    () => false,
  );
  const messages = snapshot.messages.filter(
    (message) => message.channelId === channel.id && !message.threadId,
  );
  const thread = snapshot.threads.find((item) => item.id === threadId);
  const replies = thread
    ? snapshot.messages.filter(
        (message) =>
          message.channelId === thread.channelId &&
          message.threadId === thread.id,
      )
    : [];
  const mentionMatch = text.match(/(?:^|\s)@([^\s]*)$/);
  const mentionQuery = mentionMatch?.[1]?.toLowerCase() ?? "";
  const mentionCandidates = mentionMatch
    ? [
        ...snapshot.members.map((member) => ({
          id: member.id,
          name: member.displayName,
        })),
        ...snapshot.agents.map((agent) => ({ id: agent.id, name: agent.name })),
      ]
        .filter((item) => item.name.toLowerCase().includes(mentionQuery))
        .slice(0, 5)
    : [];
  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await createMessage(server, token, snapshot.community.id, {
        channelId: channel.id,
        paragraphs: [[{ kind: "text", text: text.trim() }]],
      });
      setText("");
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not send message.",
      );
    } finally {
      setSending(false);
    }
  };
  const openThread = async (messageId: string) => {
    const existing = snapshot.threads.find(
      (item) => item.rootMessageId === messageId,
    );
    if (existing) {
      setThreadId(existing.id);
      return;
    }
    setThreadPending(true);
    try {
      const made = await createThread(server, token, snapshot.community.id, {
        channelId: channel.id,
        rootMessageId: messageId,
      });
      setThreadId(made.id);
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not open thread.",
      );
    } finally {
      setThreadPending(false);
    }
  };
  const saveChannel = async () => {
    if (!channelName.trim()) return;
    setChannelPending(true);
    try {
      await updateChannel(server, token, snapshot.community.id, channel.id, {
        name: channelName.trim(),
      });
      setEditingChannel(false);
      await onRefresh();
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not rename channel.",
      );
    } finally {
      setChannelPending(false);
    }
  };
  const archiveChannel = async () => {
    setChannelPending(true);
    try {
      await updateChannel(server, token, snapshot.community.id, channel.id, {
        status: "archived",
      });
      await onRefresh();
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not archive channel.",
      );
    } finally {
      setChannelPending(false);
    }
  };
  const leave = async () => {
    setChannelPending(true);
    try {
      await leaveChannel(server, token, snapshot.community.id, channel.id);
      await onRefresh();
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not leave channel.",
      );
    } finally {
      setChannelPending(false);
    }
  };
  const chooseMention = (name: string) => {
    setText(
      text.replace(
        /(?:^|\s)@[^\s]*$/,
        (value) => `${value.startsWith(" ") ? " " : ""}@${name} `,
      ),
    );
  };
  return (
    <div className="flex min-h-0 flex-1">
      {" "}
      <section
        className="flex min-w-0 flex-1 flex-col"
        aria-busy={threadPending}
      >
        <header className="flex min-h-14 items-center gap-3 border-b px-5">
          <Hash className="size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            {editingChannel ? (
              <div className="flex gap-2">
                <Input
                  value={channelName}
                  onChange={(event) => setChannelName(event.target.value)}
                  autoFocus
                />
                <Button
                  size="sm"
                  disabled={channelPending}
                  onClick={() => void saveChannel()}
                >
                  Save
                </Button>
              </div>
            ) : (
              <h1 className="truncate text-base font-semibold">
                {channel.name}
              </h1>
            )}
            <p className="truncate text-xs text-muted-foreground">
              {channel.description || "Conversation"}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {connected ? "Live" : "Reconnecting…"}
          </span>
          {snapshot.membership.role === "teacher" &&
          channel.kind === "channel" ? (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Rename channel"
                onClick={() => setEditingChannel(true)}
              >
                <Pencil />
              </Button>
              <ConfirmAction
                trigger={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Archive channel"
                    disabled={channelPending}
                  >
                    <Trash2 />
                  </Button>
                }
                title="Archive this channel?"
                description="The channel will become read-only and leave the active channel list."
                confirmLabel="Archive channel"
                onConfirm={archiveChannel}
              />
            </>
          ) : channel.memberIds.includes(user.id) &&
            channel.kind === "channel" ? (
            <ConfirmAction
              trigger={
                <Button size="sm" variant="ghost" disabled={channelPending}>
                  Leave
                </Button>
              }
              title="Leave this channel?"
              description="You can browse and join this public channel again later."
              confirmLabel="Leave channel"
              onConfirm={leave}
            />
          ) : null}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {messages.length ? (
            messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                snapshot={snapshot}
                user={user}
                onThread={() => void openThread(message.id)}
                threadPending={threadPending}
                server={server}
                token={token}
                onNotice={onNotice}
              />
            ))
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No messages yet. Start the conversation.
            </div>
          )}
        </div>
        <div className="border-t p-4">
          <div className="relative flex gap-2">
            {mentionCandidates.length ? (
              <div
                className="absolute bottom-full left-0 mb-2 w-64 rounded-md border bg-popover p-1 shadow-md"
                role="group"
                aria-label="Mention suggestions"
              >
                {mentionCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseMention(candidate.name)}
                  >
                    @{candidate.name}
                  </button>
                ))}
              </div>
            ) : null}
            <Textarea
              aria-label={`Message #${channel.name}`}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder={`Message #${channel.name} · use @ to mention`}
              rows={2}
              disabled={sending || channel.status === "archived"}
            />
            <Button
              disabled={
                sending || !text.trim() || channel.status === "archived"
              }
              onClick={() => void send()}
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </section>
      {thread && !threadUsesOverlay ? (
        <aside className="flex w-80 shrink-0 flex-col border-l bg-muted/20">
          <ThreadPanel
            thread={thread}
            replies={replies}
            snapshot={snapshot}
            server={server}
            token={token}
            onNotice={onNotice}
            onClose={() => setThreadId(undefined)}
          />
        </aside>
      ) : null}
      {thread && threadUsesOverlay ? (
        <Sheet open onOpenChange={(open) => !open && setThreadId(undefined)}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-sm"
            showCloseButton={false}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Thread</SheetTitle>
              <SheetDescription>
                Replies in this conversation thread
              </SheetDescription>
            </SheetHeader>
            <ThreadPanel
              thread={thread}
              replies={replies}
              snapshot={snapshot}
              server={server}
              token={token}
              onNotice={onNotice}
              onClose={() => setThreadId(undefined)}
            />
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

function MessageRow({
  message,
  snapshot,
  user,
  onThread,
  threadPending,
  server,
  token,
  onNotice,
}: {
  message: ScopedMessage;
  snapshot: HostedSnapshot;
  user: User;
  onThread: () => void;
  threadPending: boolean;
  server: string;
  token: string;
  onNotice: (text: string) => void;
}) {
  const author =
    snapshot.members.find((member) => member.id === message.authorId) ??
    snapshot.agents.find((agent) => agent.id === message.authorId);
  const authorName = author
    ? "displayName" in author
      ? author.displayName
      : author.name
    : undefined;
  const [editing, setEditing] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [value, setValue] = useState(
    message.paragraphs
      .flat()
      .map((block) => block.text)
      .join(" "),
  );
  const own = message.authorId === user.id;
  const teacher = snapshot.membership.role === "teacher";
  const body = message.deletedAt
    ? "This message was deleted."
    : message.paragraphs
        .flat()
        .map((block) => block.text)
        .join(" ");
  const save = async () => {
    setActionPending(true);
    try {
      await editMessage(server, token, snapshot.community.id, message.id, {
        paragraphs: [[{ kind: "text", text: value }]],
      });
      setEditing(false);
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not edit message.",
      );
    } finally {
      setActionPending(false);
    }
  };
  const remove = async () => {
    setActionPending(true);
    try {
      await deleteMessage(server, token, snapshot.community.id, message.id);
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not delete message.",
      );
    } finally {
      setActionPending(false);
    }
  };
  return (
    <article
      className={cn("group flex gap-3 py-3", message.deletedAt && "opacity-60")}
    >
      {author && "runtime" in author ? (
        <AgentAvatar agent={author} className="size-8" />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs">
          {authorName?.slice(0, 2).toUpperCase() ?? "?"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">
            {authorName ?? "Unknown member"}
          </span>
          <time dateTime={message.at} className="text-xs text-muted-foreground">
            {new Date(message.at).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
          {message.editedAt ? (
            <span className="text-xs text-muted-foreground">(edited)</span>
          ) : null}
        </div>
        {editing ? (
          <div className="mt-1 flex gap-2">
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
            />
            <Button
              size="sm"
              disabled={actionPending}
              onClick={() => void save()}
            >
              {actionPending ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-6">{body}</p>
        )}
        <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            size="sm"
            variant="ghost"
            disabled={threadPending || Boolean(message.deletedAt)}
            onClick={onThread}
          >
            <MessageSquare className="mr-1 size-3.5" />
            Thread
          </Button>
          {own && !message.deletedAt ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={actionPending}
              onClick={() => setEditing(true)}
            >
              <Pencil className="mr-1 size-3.5" />
              Edit
            </Button>
          ) : null}
          {(own || teacher) && !message.deletedAt ? (
            <ConfirmAction
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={actionPending}
                >
                  <Trash2 className="mr-1 size-3.5" />
                  Delete
                </Button>
              }
              title="Delete this message?"
              description="Its content will be replaced by a visible tombstone for everyone in the conversation."
              confirmLabel="Delete message"
              onConfirm={remove}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ThreadPanel({
  thread,
  replies,
  snapshot,
  server,
  token,
  onNotice,
  onClose,
}: {
  thread: ScopedThread;
  replies: ScopedMessage[];
  snapshot: HostedSnapshot;
  server: string;
  token: string;
  onNotice: (text: string) => void;
  onClose: () => void;
}) {
  const root = snapshot.messages.find(
    (message) => message.id === thread.rootMessageId,
  );
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const mentionMatch = text.match(/(?:^|\s)@([^\s]*)$/);
  const mentionQuery = mentionMatch?.[1]?.toLowerCase() ?? "";
  const mentionCandidates = mentionMatch
    ? [
        ...snapshot.members.map((member) => ({
          id: member.id,
          name: member.displayName,
        })),
        ...snapshot.agents.map((agent) => ({ id: agent.id, name: agent.name })),
      ]
        .filter((item) => item.name.toLowerCase().includes(mentionQuery))
        .slice(0, 5)
    : [];
  const chooseMention = (name: string) => {
    setText(
      text.replace(
        /(?:^|\s)@[^\s]*$/,
        (value) => `${value.startsWith(" ") ? " " : ""}@${name} `,
      ),
    );
  };
  const sendReply = async () => {
    if (!text.trim()) return;
    setPending(true);
    try {
      await createMessage(server, token, snapshot.community.id, {
        channelId: thread.channelId,
        threadId: thread.id,
        paragraphs: [[{ kind: "text", text: text.trim() }]],
      });
      setText("");
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not reply to thread.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <MessageSquare className="size-4" />
        <h2 className="flex-1 text-sm font-semibold">Thread</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {root ? <ThreadMessage message={root} snapshot={snapshot} root /> : null}
        {replies.map((reply) => (
          <ThreadMessage key={reply.id} message={reply} snapshot={snapshot} />
        ))}
      </div>
      <div className="border-t p-3">
        <div className="relative">
          {mentionCandidates.length ? (
            <div
              className="absolute bottom-full left-0 z-10 mb-2 w-64 rounded-md border bg-popover p-1 shadow-md"
              role="group"
              aria-label="Mention suggestions"
            >
              {mentionCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseMention(candidate.name)}
                >
                  @{candidate.name}
                </button>
              ))}
            </div>
          ) : null}
          <Textarea
            aria-label="Reply in thread"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!pending) void sendReply();
              }
            }}
            placeholder="Reply in thread · use @ to mention"
            rows={2}
            disabled={pending}
          />
        </div>
        <Button
          className="mt-2 w-full"
          size="sm"
          disabled={pending || !text.trim()}
          onClick={() => void sendReply()}
        >
          {pending ? "Replying…" : "Reply"}
        </Button>
      </div>
    </>
  );
}

function ThreadMessage({
  message,
  snapshot,
  root = false,
}: {
  message: ScopedMessage;
  snapshot: HostedSnapshot;
  root?: boolean;
}) {
  const author =
    snapshot.members.find((member) => member.id === message.authorId) ??
    snapshot.agents.find((agent) => agent.id === message.authorId);
  const name = author
    ? "displayName" in author
      ? author.displayName
      : author.name
    : "Unknown member";
  const body = message.deletedAt
    ? "This message was deleted."
    : message.paragraphs
        .flat()
        .map((block) => block.text)
        .join(" ");
  return (
    <article
      className={cn(
        "mt-3 text-sm",
        root ? "rounded-lg bg-card p-3" : "border-l-2 pl-3",
        message.deletedAt && "opacity-60",
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-medium">{name}</span>
        <time
          dateTime={message.at}
          className="text-xs text-muted-foreground"
        >
          {new Date(message.at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </time>
      </div>
      <p className="mt-1 whitespace-pre-wrap leading-6">{body}</p>
    </article>
  );
}

function AgentSheet({
  server,
  token,
  snapshot,
  value,
  onClose,
  onSaved,
  onNotice,
}: {
  server: string;
  token: string;
  snapshot: HostedSnapshot;
  value: ActiveAgent | "new";
  onClose: () => void;
  onSaved: () => void;
  onNotice: (text: string) => void;
}) {
  const existing = value === "new" ? undefined : value;
  const [name, setName] = useState(existing?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(existing?.avatarUrl ?? "");
  const [instructions, setInstructions] = useState(
    existing?.instructions ?? "",
  );
  const [runtime, setRuntime] = useState<"claude" | "codex" | "pi">(
    existing?.runtime ?? "claude",
  );
  const [model, setModel] = useState(existing?.model ?? "default");
  const [channels, setChannels] = useState(existing?.channelIds ?? []);
  const [pending, setPending] = useState(false);
  const [rotationPending, setRotationPending] = useState(false);
  const [enrollment, setEnrollment] = useState<{
    runnerToken: string;
    setupCommand: string;
  }>();
  const [refreshOnClose, setRefreshOnClose] = useState(false);
  const communityId = snapshot.community.id;
  const close = () => {
    onClose();
    if (refreshOnClose) onSaved();
  };
  const save = async () => {
    setPending(true);
    try {
      if (existing)
        await updateAgent(server, token, communityId, existing.id, {
          name,
          avatarUrl: avatarUrl || null,
          instructions,
          runtime,
          model,
          channelIds: channels,
        });
      else {
        const result = await createAgent(server, token, communityId, {
          name,
          avatarUrl: avatarUrl || null,
          instructions,
          runtime,
          model,
          channelIds: channels,
        });
        setEnrollment(result.enrollment);
        setRefreshOnClose(true);
      }
      if (existing) onSaved();
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not save agent.",
      );
    } finally {
      setPending(false);
    }
  };
  const rotate = async () => {
    if (!existing) return;
    setRotationPending(true);
    try {
      const result = await rotateAgent(server, token, communityId, existing.id);
      setEnrollment(result.enrollment);
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not rotate token.",
      );
    } finally {
      setRotationPending(false);
    }
  };
  const remove = async () => {
    if (!existing) return;
    try {
      await deleteAgent(server, token, communityId, existing.id);
      onClose();
      onSaved();
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not delete agent.",
      );
    }
  };
  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {existing ? (
              <AgentAvatar agent={existing} className="size-7" />
            ) : (
              <Bot />
            )}
            {existing ? "Edit agent" : "New agent"}
          </SheetTitle>
          <SheetDescription>
            Configure identity, instructions, and channel access for this agent.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="flex flex-col gap-1">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Agent name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="agent-avatar">Avatar URL (optional)</Label>
            <Input
              id="agent-avatar"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="agent-instructions">Instructions</Label>
            <Textarea
              id="agent-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Describe the agent's role and boundaries."
              rows={6}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="agent-runtime">Runtime</Label>
              <Select
                value={runtime}
                onValueChange={(value) =>
                  value && setRuntime(value as "claude" | "codex" | "pi")
                }
              >
                <SelectTrigger id="agent-runtime" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Claude</SelectItem>
                  <SelectItem value="codex">Codex</SelectItem>
                  <SelectItem value="pi">Pi (ChatGPT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="agent-model">Model</Label>
              <Input
                id="agent-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="Model"
              />
            </div>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Channel memberships
            </legend>
            {snapshot.channels
              .filter((channel) => channel.kind === "channel")
              .map((channel) => (
                <label
                  key={channel.id}
                  className="flex items-center gap-2 py-1 text-sm"
                >
                  <Checkbox
                    checked={channels.includes(channel.id)}
                    onCheckedChange={(checked) =>
                      setChannels((current) =>
                        checked
                          ? [...current, channel.id]
                          : current.filter((id) => id !== channel.id),
                      )
                    }
                  />
                  #{channel.name}
                </label>
              ))}
          </fieldset>
          <Button
            className="w-full"
            disabled={pending || (!existing && Boolean(enrollment))}
            onClick={() => void save()}
          >
            {pending
              ? "Saving…"
              : existing
                ? "Save changes"
                : enrollment
                  ? "Agent created"
                  : "Create agent"}
          </Button>
          {existing ? (
            <div className="flex gap-2">
              <ConfirmAction
                trigger={
                  <Button variant="outline" disabled={rotationPending}>
                    Rotate setup token
                  </Button>
                }
                title="Rotate this setup token?"
                description="The previous runner credential stops working immediately. Save the new command once."
                confirmLabel="Rotate token"
                onConfirm={rotate}
              />
              <ConfirmAction
                trigger={
                  <Button variant="destructive" disabled={pending}>
                    <Trash2 /> Delete
                  </Button>
                }
                title="Delete this agent?"
                description="The agent will leave the community and its private conversations will be archived."
                confirmLabel="Delete agent"
                onConfirm={remove}
              />
            </div>
          ) : null}
          {enrollment ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Save this setup credential now</p>
              <Label className="mt-2 block text-xs text-muted-foreground">
                Runner token (shown once)
              </Label>
              <code className="mt-1 block break-all text-xs">
                {enrollment.runnerToken}
              </code>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  void navigator.clipboard?.writeText(enrollment.runnerToken);
                  onNotice("Runner token copied.");
                }}
              >
                Copy runner token
              </Button>
              <Label className="mt-3 block text-xs text-muted-foreground">
                Setup command
              </Label>
              <code className="mt-2 block break-all text-xs">
                {enrollment.setupCommand}
              </code>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  void navigator.clipboard?.writeText(enrollment.setupCommand);
                }}
              >
                Copy command
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InviteSheet({
  server,
  token,
  communityId,
  onClose,
  onNotice,
}: {
  server: string;
  token: string;
  communityId: string;
  onClose: () => void;
  onNotice: (text: string) => void;
}) {
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [mode, setMode] = useState<"single-use" | "reusable">("single-use");
  const [result, setResult] = useState<InviteCreateResult>();
  const [pending, setPending] = useState(false);
  const generate = async () => {
    setPending(true);
    try {
      setResult(await createInvite(server, token, communityId, { role, mode }));
    } catch (cause) {
      onNotice(
        cause instanceof Error ? cause.message : "Could not create invite.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Invite members</SheetTitle>
          <SheetDescription>
            Create a role-scoped code and share the raw code securely.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-6">
          <Label htmlFor="invite-role">Role</Label>
          <Select
            value={role}
            onValueChange={(value) =>
              value && setRole(value as "teacher" | "student")
            }
          >
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="teacher">Teacher</SelectItem>
            </SelectContent>
          </Select>
          <Label htmlFor="invite-mode">Use</Label>
          <Select
            value={mode}
            onValueChange={(value) =>
              value && setMode(value as "single-use" | "reusable")
            }
          >
            <SelectTrigger id="invite-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single-use">Single use</SelectItem>
              <SelectItem value="reusable">Reusable</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => void generate()}
          >
            {pending ? "Generating…" : "Generate invite code"}
          </Button>
          {result ? (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Copy this raw code and share it securely.
              </p>
              <code className="mt-2 block break-all text-sm">
                {result.code}
              </code>
              <Button
                className="mt-3 w-full"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(result.code);
                  onNotice("Invite code copied.");
                }}
              >
                <Copy className="mr-1 size-4" />
                Copy code
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  trigger: React.ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // Action-level handlers surface their own server errors.
    } finally {
      setPending(false);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={() => void confirm()}>
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
