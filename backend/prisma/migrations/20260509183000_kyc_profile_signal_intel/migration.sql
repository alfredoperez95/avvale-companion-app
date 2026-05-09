-- Hipótesis comerciales desde señales (separado de avvale.projects)
ALTER TABLE "kyc_profiles" ADD COLUMN "signal_intel" JSONB NOT NULL DEFAULT '{}';
