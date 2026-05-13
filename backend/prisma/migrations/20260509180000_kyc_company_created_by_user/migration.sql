-- KYC: quién creó la cuenta en Companion (filtro «solo mías» en launcher).
ALTER TABLE `kyc_companies` ADD COLUMN `created_by_user_id` VARCHAR(191) NULL;
CREATE INDEX `kyc_companies_created_by_user_id_idx` ON `kyc_companies` (`created_by_user_id`);
