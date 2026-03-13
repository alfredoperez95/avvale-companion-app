-- CreateTable activation_attachments (archivos descargados desde URLs recopiladas)
CREATE TABLE `activation_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `activation_id` VARCHAR(191) NOT NULL,
    `original_url` TEXT NOT NULL,
    `stored_path` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `content_type` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `activation_attachments` ADD CONSTRAINT `activation_attachments_activation_id_fkey` FOREIGN KEY (`activation_id`) REFERENCES `activations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
