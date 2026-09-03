# Is there an open-source Archil we could run on Railway?

Date: 2026-08-23. Context: for the Railway template
(`research/2026-08-23-railway-deploy-template.md`) Ignacio asked whether an
open-source Archil equivalent could provide the "filesystem service" (agent
folders) as a Railway service. Short answer: **a mounted shared filesystem is
not possible on Railway today — and the template doesn't need one.** Claims
verified in original sources unless marked snippet.

## Archil itself

Proprietary, hosted-only, paid (no repo or license anywhere; formerly Regatta,
per CB Insights). It mounts an object-storage bucket as a POSIX filesystem
through a client that needs root: `sudo archil mount`, and in containers
literally "--privileged … to give your container permission to mount external
file systems" (docs.archil.com/mounting/linux, /mounting/containers). The
"NVMe cache" detail circulating in blogs is not in Archil's own docs
(snippet-only); their docs say "durable, multi-AZ, server-side cache".

## The decisive constraint: Railway forbids the privileges every mount needs

- **No FUSE, no privileged containers, no CAP_SYS_ADMIN.** Railway staff on
  Central Station: "You simply can't do such things on Railway.. Yet"
  (privileged-mode request); a FUSE-based workaround was answered with
  "would require FuseFS support, which Railway doesn't provide in
  non-privileged containers" (station.railway.com feedback threads, original).
- **Volumes: one per service, never shared across services.** Docs +staff on
  the 70-upvote "Shared Volumes" request: "not possible, sharing data would
  have to be done via minio or similar … not currently planning to implement"
  (docs.railway.com/reference/volumes, station thread, original). Multiple
  processes inside one service do share its volume (standard container
  behavior).
- NFS/SMB between services over the private network fails on the same rock:
  the *client* mount syscall needs CAP_SYS_ADMIN (inference from standard
  Linux + Railway's policy; no direct Railway source — unverified).

Every open-source candidate that gives a real mounted path — JuiceFS,
SeaweedFS FUSE, MooseFS, CephFS, GlusterFS, nfs-ganesha-backed NFS, rclone
mount, s3fs — needs exactly those privileges on the client side. So the
mounted-Archil pattern is out on Railway, regardless of which OSS project
plays the part.

## What does work unprivileged (if we ever need shared files)

- **JuiceFS S3 Gateway / WebDAV mode** (Apache-2.0) and **SeaweedFS Filer
  HTTP/S3/WebDAV** (Apache-2.0): a gateway service owns the storage; other
  services read/write over HTTP/S3 — live shared access, but consumers speak
  an API, not a local path, which defeats the point for a runner whose whole
  contract is "`claude` runs with cwd in a real folder".
- **git push/pull to a bare repo**: eventual-consistency sync of working
  folders, no privileges, and it *is* our data model — the agent wiki is
  already a git repo with one commit per run.

## Consequence for Ada

The template needs no shared filesystem at all: one deploy = one course
(decided by Ignacio, 08/23) = one server service with its single volume
(`ada.db` + `data/<course>/raw`). The agent folder lives where the runner
runs — the teacher's machine by default, or an optional runner *service* whose
own volume holds the folder. The natural open "filesystem service" for Ada is
**git itself** (bare repo as backup/sync/audit of agent folders), not an
Archil clone. Archil stays where `DECISIONS.md` §14.7 put it: the composition
layer of the hosted tier, only once agents must share folders across machines
— and that tier won't live on Railway's container platform anyway.
