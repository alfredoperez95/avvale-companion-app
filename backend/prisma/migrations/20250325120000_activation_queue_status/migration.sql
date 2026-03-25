-- Migrate legacy ERROR to FAILED before altering ENUM
UPDATE `activations` SET `status` = 'FAILED' WHERE `status` = 'ERROR';

-- Replace ActivationStatus enum (MySQL/MariaDB: full enum list required)
-- Nota: migración histórica; el valor READY_TO_SEND fue sustituido por PENDING_CALLBACK en 20250326100000_pending_callback_status.
ALTER TABLE `activations` MODIFY COLUMN `status` ENUM(
  'DRAFT',
  'READY_TO_SEND',
  'SENT',
  'QUEUED',
  'PROCESSING',
  'RETRYING',
  'FAILED'
) NOT NULL DEFAULT 'DRAFT';

-- Audit / queue metadata
ALTER TABLE `activations`
  ADD COLUMN `queued_at` DATETIME(3) NULL,
  ADD COLUMN `processing_started_at` DATETIME(3) NULL,
  ADD COLUMN `send_attempt_count` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `bull_job_id` VARCHAR(191) NULL;

CREATE INDEX `activations_status_idx` ON `activations`(`status`);
