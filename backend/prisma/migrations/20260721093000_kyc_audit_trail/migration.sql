-- KYC audit trail: actor attribution and durable action log.

ALTER TABLE `kyc_companies`
  ADD COLUMN `updated_by_user_id` VARCHAR(191) NULL;

CREATE TABLE `kyc_audit_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `company_id` BIGINT NULL,
  `actor_user_id` VARCHAR(191) NULL,
  `action` VARCHAR(96) NOT NULL,
  `entity` VARCHAR(96) NOT NULL,
  `entity_id` VARCHAR(128) NULL,
  `before` JSON NULL,
  `after` JSON NULL,
  `meta` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `kyc_companies_updated_by_user_id_idx` ON `kyc_companies`(`updated_by_user_id`);
CREATE INDEX `kyc_audit_logs_company_id_created_at_idx` ON `kyc_audit_logs`(`company_id`, `created_at`);
CREATE INDEX `kyc_audit_logs_actor_user_id_created_at_idx` ON `kyc_audit_logs`(`actor_user_id`, `created_at`);
CREATE INDEX `kyc_audit_logs_action_created_at_idx` ON `kyc_audit_logs`(`action`, `created_at`);

ALTER TABLE `kyc_audit_logs`
  ADD CONSTRAINT `kyc_audit_logs_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `kyc_companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `kyc_audit_logs`
  ADD CONSTRAINT `kyc_audit_logs_actor_user_id_fkey`
  FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
