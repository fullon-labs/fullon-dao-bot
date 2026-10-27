import pg from 'pg';

export type Db=pg.Pool;
export const createDb=(connectionString:string)=>new pg.Pool({connectionString,max:10});

export const migrations=[`
CREATE TABLE IF NOT EXISTS auth_challenges (
  id uuid PRIMARY KEY,
  account text NOT NULL,
  permission_name text NOT NULL,
  message jsonb NOT NULL,
  message_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_challenges_expiry_idx ON auth_challenges(expires_at);

CREATE TABLE IF NOT EXISTS discussions (
  id uuid PRIMARY KEY,
  github_node_id text NOT NULL UNIQUE,
  github_number bigint NOT NULL UNIQUE,
  github_url text NOT NULL,
  github_category text NOT NULL,
  title text NOT NULL,
  body_hash text NOT NULL,
  fullon_account text NOT NULL,
  permission_name text NOT NULL,
  chain_id text NOT NULL,
  proof_signature text NOT NULL,
  proof_public_key text NOT NULL,
  proof_message jsonb NOT NULL,
  proposal_id bigint UNIQUE,
  proposal_tx_id text,
  proposal_status text,
  last_chain_state_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discussions_created_idx ON discussions(created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  delivery_id text PRIMARY KEY,
  event_name text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
`];

export async function migrate(db:Db){
  for(const sql of migrations)await db.query(sql);
}
