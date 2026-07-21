-- Global audit trail for Avvale Companion activity across modules.

CREATE TABLE `audit_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `actor_user_id` VARCHAR(191) NULL,
  `actor_email` VARCHAR(320) NULL,
  `actor_role` VARCHAR(32) NULL,
  `actor_type` VARCHAR(32) NOT NULL,
  `module` VARCHAR(64) NOT NULL,
  `action` VARCHAR(96) NOT NULL,
  `entity` VARCHAR(96) NULL,
  `entity_id` VARCHAR(128) NULL,
  `method` VARCHAR(10) NULL,
  `path` VARCHAR(512) NOT NULL,
  `route` VARCHAR(512) NULL,
  `status_code` INTEGER NULL,
  `request_id` VARCHAR(64) NULL,
  `ip` VARCHAR(128) NULL,
  `user_agent` VARCHAR(512) NULL,
  `token_hash` VARCHAR(64) NULL,
  `before` JSON NULL,
  `after` JSON NULL,
  `meta` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `audit_logs_actor_user_id_created_at_idx` ON `audit_logs`(`actor_user_id`, `created_at`);
CREATE INDEX `audit_logs_module_created_at_idx` ON `audit_logs`(`module`, `created_at`);
CREATE INDEX `audit_logs_action_created_at_idx` ON `audit_logs`(`action`, `created_at`);
CREATE INDEX `audit_logs_entity_entity_id_created_at_idx` ON `audit_logs`(`entity`, `entity_id`, `created_at`);
CREATE INDEX `audit_logs_request_id_idx` ON `audit_logs`(`request_id`);
CREATE INDEX `audit_logs_token_hash_idx` ON `audit_logs`(`token_hash`);
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs`(`created_at`);

ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_actor_user_id_fkey`
  FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
