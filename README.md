# FullOn DAO Bot

Independent community-discussion bridge for FullOn DAO governance.

The service verifies a FullOn wallet proof, creates a GitHub Discussion as
`FullOn DAO Bot`, stores the Discussion/proposal mapping, and synchronizes
on-chain proposal state back to GitHub. It never holds `dao.gov`, treasury, or
system-contract authority.

## Components

- HTTP API: wallet challenges, proof verification, discussion creation/listing,
  and proposal linking.
- GitHub App client: creates Discussions and lifecycle comments using an
  installation token. No personal access token is used.
- Chain worker: reads `dao.gov::proposals` and publishes material state changes.
- PostgreSQL: stores single-use challenges and Discussion/proposal mappings.

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm run db:migrate
pnpm run dev
```

The service listens on `127.0.0.1:8787` by default. See
[`docs/architecture.md`](docs/architecture.md) for the trust model and API flow.

## API

```text
POST /v1/auth/challenge
POST /v1/auth/verify
GET  /v1/discussions
POST /v1/discussions
POST /v1/discussions/:number/link-proposal
POST /v1/webhooks/github
GET  /v1/verification/:id
GET  /healthz
```

Creating a Discussion is intentionally a two-step operation: request a
challenge, sign the canonical challenge message with the indicated FullOn
permission, then submit the signature together with the exact title/body. The
challenge binds the domain, chain ID, account, permission, content hashes,
purpose, nonce, and expiry.

## Security

- GitHub App private key and webhook secret are server-only.
- Challenges expire after five minutes and are consumed once.
- The recovered signing key must exist on the requested current account
  permission.
- Repository, category, network, and chain ID are allowlisted by configuration.
- GitHub webhook signatures are verified with `X-Hub-Signature-256`.
- The chain worker is read-only. Permissionless execution is deliberately not
  part of this initial service.
