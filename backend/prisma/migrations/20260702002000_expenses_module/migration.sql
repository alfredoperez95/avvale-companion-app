-- CreateTable
CREATE TABLE `expenses` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NULL,
    `type` VARCHAR(128) NULL,
    `expense_date` DATETIME(3) NULL,
    `file_url` VARCHAR(1024) NOT NULL,
    `original_file_name` VARCHAR(512) NOT NULL,
    `storage_path` VARCHAR(1024) NOT NULL,
    `mime_type` VARCHAR(255) NOT NULL,
    `status` ENUM('pending_review', 'processed') NOT NULL DEFAULT 'pending_review',
    `extraction_error` TEXT NULL,
    `raw_model_output` LONGTEXT NULL,
    `model_id` VARCHAR(128) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `expenses_user_id_idx`(`user_id`),
    INDEX `expenses_status_idx`(`status`),
    INDEX `expenses_expense_date_idx`(`expense_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
