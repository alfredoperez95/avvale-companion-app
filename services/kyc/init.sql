-- Workzone KYC — clean schema (standalone Docker slice)
-- Applied automatically by the postgres image on first boot.

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- AUTH
-- ============================================================
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- COMPANIES + CONTACTS (minimal, referenced by KYC)
-- ============================================================
CREATE TABLE companies (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  sector      TEXT,
  industry    TEXT,
  city        TEXT,
  country     TEXT DEFAULT 'Spain',
  website     TEXT,
  revenue     TEXT,
  employees   TEXT,
  tech_stack  TEXT,
  source      TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX companies_name_idx ON companies (lower(name));
CREATE INDEX companies_sector_idx ON companies (sector);
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE contacts (
  id           BIGSERIAL PRIMARY KEY,
  company_id   BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  first_name   TEXT NOT NULL,
  last_name    TEXT,
  email        CITEXT,
  phone        TEXT,
  job_title    TEXT,
  linkedin     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contacts_company_idx ON contacts (company_id);
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- KYC PROFILES + ORG + SIGNALS + FACTS + CHAT + OPEN QUESTIONS
-- ============================================================
CREATE TABLE kyc_profiles (
  company_id        BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  economics         JSONB NOT NULL DEFAULT '{}'::jsonb,
  business_model    JSONB NOT NULL DEFAULT '{}'::jsonb,
  customers         JSONB NOT NULL DEFAULT '{}'::jsonb,
  tech_stack        JSONB NOT NULL DEFAULT '{}'::jsonb,
  critical_processes JSONB NOT NULL DEFAULT '{}'::jsonb,
  sector_context    JSONB NOT NULL DEFAULT '{}'::jsonb,
  competencia       JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary           TEXT,
  confidence_score  INT DEFAULT 0,
  strategic         BOOLEAN NOT NULL DEFAULT false,
  last_enriched_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kyc_profiles_strategic_idx ON kyc_profiles (strategic) WHERE strategic = true;
CREATE TRIGGER kyc_profiles_updated_at BEFORE UPDATE ON kyc_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE kyc_org_members (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id    BIGINT REFERENCES contacts(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  role          TEXT,
  area          TEXT,
  level         INT,
  reports_to_id BIGINT REFERENCES kyc_org_members(id) ON DELETE SET NULL,
  linkedin      TEXT,
  notes         TEXT,
  source        TEXT DEFAULT 'manual',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kyc_org_members_company_idx ON kyc_org_members (company_id);
CREATE INDEX kyc_org_members_reports_idx ON kyc_org_members (reports_to_id);
CREATE TRIGGER kyc_org_members_updated_at BEFORE UPDATE ON kyc_org_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE kyc_org_relationships (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_member_id BIGINT NOT NULL REFERENCES kyc_org_members(id) ON DELETE CASCADE,
  to_member_id   BIGINT NOT NULL REFERENCES kyc_org_members(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('aliado','bloqueador','influencer','mentor','rival','otro')),
  strength      INT DEFAULT 3 CHECK (strength BETWEEN 1 AND 5),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kyc_org_rel_company_idx ON kyc_org_relationships (company_id);

CREATE TABLE kyc_signals (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source        TEXT NOT NULL,
  source_url    TEXT,
  sentiment     TEXT CHECK (sentiment IN ('positive','neutral','negative','mixed')),
  rating        NUMERIC(3,1),
  title         TEXT,
  text          TEXT,
  signal_type   TEXT DEFAULT 'review',
  published_at  TIMESTAMPTZ,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kyc_signals_company_idx ON kyc_signals (company_id, captured_at DESC);
CREATE INDEX kyc_signals_source_idx ON kyc_signals (source);

CREATE TABLE kyc_facts (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  field_path    TEXT NOT NULL,
  value         JSONB,
  prev_value    JSONB,
  source        TEXT NOT NULL,
  source_ref    TEXT,
  confidence    NUMERIC(3,2),
  user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  chat_message_id BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kyc_facts_company_idx ON kyc_facts (company_id, created_at DESC);
CREATE INDEX kyc_facts_field_idx ON kyc_facts (company_id, field_path);

CREATE TABLE kyc_chat_sessions (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  title         TEXT,
  workdir       TEXT,
  session_type  TEXT NOT NULL DEFAULT 'research'
    CHECK (session_type IN ('research','intake')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kyc_chat_sessions_company_idx ON kyc_chat_sessions (company_id, updated_at DESC);
CREATE TRIGGER kyc_chat_sessions_updated_at BEFORE UPDATE ON kyc_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE kyc_chat_messages (
  id            BIGSERIAL PRIMARY KEY,
  session_id    BIGINT NOT NULL REFERENCES kyc_chat_sessions(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content       TEXT NOT NULL,
  meta          JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kyc_chat_messages_session_idx ON kyc_chat_messages (session_id, id);

CREATE TABLE kyc_open_questions (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  topic         TEXT NOT NULL,
  question      TEXT NOT NULL,
  priority      INT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','skipped')),
  answer        TEXT,
  source        TEXT DEFAULT 'intake',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX kyc_open_questions_company_idx
  ON kyc_open_questions (company_id, status, priority);

COMMIT;
