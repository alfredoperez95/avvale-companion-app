-- AlterTable
ALTER TABLE `rfq_analyses` ADD COLUMN `kyc_company_id` BIGINT NULL;

-- CreateIndex
CREATE INDEX `rfq_analyses_kyc_company_id_idx` ON `rfq_analyses`(`kyc_company_id`);

-- AddForeignKey
ALTER TABLE `rfq_analyses` ADD CONSTRAINT `rfq_analyses_kyc_company_id_fkey` FOREIGN KEY (`kyc_company_id`) REFERENCES `kyc_companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
