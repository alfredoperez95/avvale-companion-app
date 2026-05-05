-- Industria canónica (misma escala que User.industry en la app).
ALTER TABLE `kyc_companies` ADD COLUMN `industry` VARCHAR(191) NULL;
CREATE INDEX `kyc_companies_industry_idx` ON `kyc_companies`(`industry`);
