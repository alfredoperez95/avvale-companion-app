-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activations` (
    `id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NOT NULL,
    `created_by_user_id` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'READY_TO_SEND', 'SENT', 'ERROR') NOT NULL DEFAULT 'DRAFT',
    `recipient_to` VARCHAR(191) NOT NULL,
    `recipient_cc` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `template_code` VARCHAR(191) NOT NULL,
    `project_name` VARCHAR(191) NOT NULL,
    `offer_code` VARCHAR(191) NOT NULL,
    `hubspot_url` VARCHAR(191) NULL,
    `make_sent_at` DATETIME(3) NULL,
    `make_run_id` VARCHAR(191) NULL,
    `error_message` TEXT NULL,
    `last_status_at` DATETIME(3) NULL,

    INDEX `activations_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `activations` ADD CONSTRAINT `activations_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
