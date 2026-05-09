-- Hipótesis comerciales desde señales (separado de avvale.projects). MySQL (no JSONB).
ALTER TABLE `kyc_profiles` ADD COLUMN `signal_intel` JSON NOT NULL DEFAULT (JSON_OBJECT());
