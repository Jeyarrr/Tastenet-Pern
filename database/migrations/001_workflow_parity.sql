-- Additive upgrade; existing imported users, orders and inventory are preserved.
ALTER TABLE tastenet.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE tastenet.users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE tastenet.tickets ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE tastenet.tickets ADD COLUMN IF NOT EXISTS stock_deducted_at timestamptz;
ALTER TABLE tastenet.tickets ADD COLUMN IF NOT EXISTS subtotal numeric(12,2);
ALTER TABLE tastenet.tickets ADD COLUMN IF NOT EXISTS delivery_fee numeric(12,2);
ALTER TABLE tastenet.tickets ADD COLUMN IF NOT EXISTS special_instructions text;
ALTER TABLE tastenet.tickets ADD COLUMN IF NOT EXISTS request_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS tickets_request_key_idx ON tastenet.tickets(created_by, request_key) WHERE request_key IS NOT NULL;
ALTER TABLE tastenet.menu ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE tastenet.email_otps ADD COLUMN IF NOT EXISTS purpose varchar(30) NOT NULL DEFAULT 'reset';
ALTER TABLE tastenet.email_otps ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE tastenet.email_otps ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE tastenet.rider_doc_approvals ADD COLUMN IF NOT EXISTS reviewed_by bigint REFERENCES tastenet.users(id);
ALTER TABLE tastenet.rider_doc_approvals ADD COLUMN IF NOT EXISTS review_notes text;

CREATE TABLE IF NOT EXISTS tastenet.order_ratings (
  ticket_id bigint PRIMARY KEY REFERENCES tastenet.tickets(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES tastenet.users(id),
  rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment varchar(1000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tastenet.media_files (
  id uuid PRIMARY KEY,
  owner_id bigint NOT NULL REFERENCES tastenet.users(id),
  ticket_id bigint REFERENCES tastenet.tickets(id) ON DELETE SET NULL,
  purpose varchar(40) NOT NULL,
  content_type varchar(80) NOT NULL,
  size integer NOT NULL CHECK(size BETWEEN 1 AND 3145728),
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_files_owner_idx ON tastenet.media_files(owner_id, created_at DESC);
CREATE TABLE IF NOT EXISTS tastenet.auth_challenges (
  token_hash char(64) PRIMARY KEY, purpose varchar(40) NOT NULL,
  payload jsonb NOT NULL, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tastenet.request_limits (
  key_hash char(64) PRIMARY KEY, hits integer NOT NULL,
  expires_at timestamptz NOT NULL
);
