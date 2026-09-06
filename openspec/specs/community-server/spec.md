# community-server Specification

## Purpose

Defines the tenant-safe account, membership, and invite operations required by the routed interaction model without changing Ada's credential or runner boundaries.

## Requirements

### Requirement: Global profile update
The service SHALL allow an authenticated active user to update their own display name through `PATCH /api/users/me`. It MUST validate and normalize the name, update derived initials and timestamps, and return only the safe user projection.

#### Scenario: Update a valid display name
- **WHEN** an authenticated active user submits a valid `displayName`
- **THEN** the service persists the normalized name and initials and returns the updated safe user

#### Scenario: Reject an invalid display name
- **WHEN** an authenticated user submits an empty or oversized display name
- **THEN** the service rejects the request as invalid input without changing the user

#### Scenario: Prevent cross-account update
- **WHEN** a bearer token is absent or invalid
- **THEN** the service rejects the profile update without revealing account data

### Requirement: Teacher-managed membership roles
The service SHALL allow a teacher to update an active community member's role through `PATCH /api/communities/:communityId/members/:userId`. It MUST preserve at least one active teacher and MUST emit a tenant-scoped `membership.updated` event after persistence.

#### Scenario: Promote a student
- **WHEN** a teacher changes an active student's role to teacher
- **THEN** the service returns the updated membership and broadcasts it only to authorized community viewers

#### Scenario: Demote a non-last teacher
- **WHEN** a teacher changes another teacher to student while another active teacher remains
- **THEN** the service persists and returns the updated membership

#### Scenario: Reject last-teacher demotion
- **WHEN** a role change would leave the community with no active teacher
- **THEN** the service rejects the request and leaves the membership unchanged

#### Scenario: Reject student administration
- **WHEN** a student attempts to change any membership role
- **THEN** the service rejects the request as forbidden

### Requirement: Safe invite listing
The service SHALL provide teachers `GET /api/communities/:communityId/invites` for active invite metadata in that community. The response MUST omit every raw invite code and code digest and MUST not expose invites across tenant boundaries.

#### Scenario: List active invites
- **WHEN** a teacher lists community invites
- **THEN** the service returns non-revoked, non-expired, non-exhausted invite metadata with role, mode, uses, maximum uses, creator, creation time, and expiration where present

#### Scenario: List invites as a student
- **WHEN** a student requests the invite list
- **THEN** the service rejects the request as forbidden

#### Scenario: List another community's invites
- **WHEN** a teacher uses a membership token that is not active in the requested community
- **THEN** the service rejects the request without returning metadata

### Requirement: Invite revocation
The service SHALL allow a teacher to revoke an active invite through `DELETE /api/communities/:communityId/invites/:inviteId`. Revocation MUST be persisted, MUST be idempotently represented as metadata, and MUST prevent subsequent redemption.

#### Scenario: Revoke an active invite
- **WHEN** a teacher revokes an invite in their community
- **THEN** the service records a revocation timestamp and returns safe metadata without the code

#### Scenario: Redeem a revoked invite
- **WHEN** any user attempts to redeem a revoked code
- **THEN** the service rejects redemption without creating or reactivating a membership

#### Scenario: Revoke an invite from another tenant
- **WHEN** a teacher attempts to revoke an invite outside their community
- **THEN** the service rejects the request without modifying either community

### Requirement: Invite redemption consumption result
Invite redemption SHALL report whether the code was consumed by this request. Redeeming while the authenticated user is already an active member MUST return that membership with `consumed: false` and MUST NOT increment invite use count.

#### Scenario: Consume an invite
- **WHEN** a valid non-expired, non-revoked invite creates or reactivates membership
- **THEN** the response includes `consumed: true` and the invite use count increments atomically

#### Scenario: Redeem as an existing active member
- **WHEN** an active member redeems a valid invite for the same community
- **THEN** the response includes `consumed: false` and the invite use count remains unchanged

### Requirement: Invite credential boundaries
Raw invite codes MUST appear only in successful creation responses and redemption request bodies. Ordinary invite list, revoke, workspace snapshot, event, and log payloads MUST contain metadata only.

#### Scenario: Observe invite management traffic
- **WHEN** a teacher lists or revokes invites or another member receives a community event
- **THEN** no raw invite code or digest appears in the payload

### Requirement: Existing tenancy and runner boundaries remain intact
All added operations MUST derive the actor from the user bearer, derive the tenant from the community path when applicable, store only credential digests, and leave model execution and provider credentials in the external runner.

#### Scenario: Authorize a scoped mutation
- **WHEN** an authenticated user invokes a membership or invite mutation
- **THEN** the service applies both membership and role authorization before changing tenant data

#### Scenario: Run an enrolled agent
- **WHEN** profile, role, or invite operations are added
- **THEN** agent enrollment and provider execution continue to use the existing outbound runner contract without receiving provider credentials
