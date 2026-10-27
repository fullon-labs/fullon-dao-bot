# Architecture and trust model

## Governance flow

1. The DApp requests a challenge for the exact Discussion title and body.
2. HuFu signs the canonical message using the selected FullOn permission.
3. DAO Bot recovers the public key and checks it against the live account
   permission returned by the configured FullOn RPC.
4. DAO Bot consumes the nonce and creates a GitHub Discussion using a GitHub
   App installation token.
5. The DApp places the returned `discussion_uri` in `dao.gov::propose`.
6. After the transaction is irreversible, the DApp links its proposal ID and
   transaction ID. DAO Bot verifies that the on-chain proposer and
   `discussion_uri` match the signed Discussion before updating GitHub.
7. A read-only worker publishes material proposal-state changes.

## Identity statement

The GitHub author is the GitHub App. The FullOn account shown in the Discussion
is the cryptographically verified governance identity. These are intentionally
separate identities.

## Replay resistance

The signed message includes the service domain, purpose, chain ID, account,
permission, title hash, body hash, nonce, issue time, and expiry. A nonce is
valid for one use and at most five minutes by default.

## Authority boundary

DAO Bot has no privileged FullOn key. It cannot create proposals, vote, bypass
Timelock, spend treasury assets, or alter governance configuration. GitHub
credentials grant only Discussions read/write and Metadata read access to the
configured repository.

## Production deployment

- Run API and worker as different containers and unprivileged users.
- Put PostgreSQL on a private network and require TLS for remote connections.
- Store the GitHub App private key and webhook secret in a secret manager.
- Terminate TLS at the edge and proxy only `/v1/*` and `/healthz`.
- Use separate GitHub App installations and databases for testnet and mainnet.
- Pin the FullOn chain ID; never infer network identity from an RPC hostname.
