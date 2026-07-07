CREATE TABLE `expense_month_exports` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `year` INTEGER NOT NULL,
  `month` INTEGER NOT NULL,
  `token` VARCHAR(64) NOT NULL,
  `storage_path` VARCHAR(1024) NOT NULL,
  `expense_ids` JSON NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `expense_month_exports_token_key` (`token`),
  INDEX `expense_month_exports_user_id_idx` (`user_id`),
  INDEX `expense_month_exports_expires_at_idx` (`expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `expense_month_exports`
  ADD CONSTRAINT `expense_month_exports_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
