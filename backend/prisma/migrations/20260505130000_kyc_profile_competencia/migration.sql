-- KYC: partners / competencia en el perfil (lista en JSON).
ALTER TABLE `kyc_profiles` ADD COLUMN `competencia` JSON NOT NULL DEFAULT (JSON_OBJECT());
