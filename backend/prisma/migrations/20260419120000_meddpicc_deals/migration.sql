-- CreateTable
CREATE TABLE `meddpicc_deals` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(512) NOT NULL,
    `company` VARCHAR(512) NOT NULL DEFAULT '',
    `owner_label` VARCHAR(200) NULL,
    `value` VARCHAR(200) NOT NULL DEFAULT '',
    `context` TEXT NULL,
    `scores` JSON NOT NULL DEFAULT ('{}'),
    `answers` JSON NOT NULL DEFAULT ('{}'),
    `notes` JSON NOT NULL DEFAULT ('{}'),
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meddpicc_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `deal_id` VARCHAR(191) NOT NULL,
    `dimension` VARCHAR(16) NOT NULL,
    `score` INTEGER NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `meddpicc_deals` ADD CONSTRAINT `meddpicc_deals_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meddpicc_history` ADD CONSTRAINT `meddpicc_history_deal_id_fkey` FOREIGN KEY (`deal_id`) REFERENCES `meddpicc_deals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `meddpicc_deals_user_id_idx` ON `meddpicc_deals`(`user_id`);

-- CreateIndex
CREATE INDEX `meddpicc_deals_status_idx` ON `meddpicc_deals`(`status`);

-- CreateIndex
CREATE INDEX `meddpicc_history_deal_id_created_at_idx` ON `meddpicc_history`(`deal_id`, `created_at` DESC);
