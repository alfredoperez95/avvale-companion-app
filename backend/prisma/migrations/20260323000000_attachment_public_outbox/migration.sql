ALTER TABLE `activation_attachments`
  ADD COLUMN `public_token` VARCHAR(191) NULL,
  ADD COLUMN `public_expires_at` DATETIME(3) NULL,
  ADD COLUMN `published_at` DATETIME(3) NULL;

CREATE UNIQUE INDEX `activation_attachments_public_token_key`
  ON `activation_attachments`(`public_token`);
