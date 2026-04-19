-- CreateTable
CREATE TABLE `meddpicc_deal_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `deal_id` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(512) NOT NULL,
    `mime_type` VARCHAR(255) NOT NULL,
    `storage_path` VARCHAR(1024) NOT NULL,
    `extracted_markdown` LONGTEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `meddpicc_deal_attachments` ADD CONSTRAINT `meddpicc_deal_attachments_deal_id_fkey` FOREIGN KEY (`deal_id`) REFERENCES `meddpicc_deals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `meddpicc_deal_attachments_deal_id_idx` ON `meddpicc_deal_attachments`(`deal_id`);
