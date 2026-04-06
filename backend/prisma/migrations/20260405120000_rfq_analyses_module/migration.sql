-- CreateTable
CREATE TABLE `rfq_analyses` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `source_type` ENUM('MANUAL', 'EMAIL') NOT NULL,
    `status` ENUM('DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `title` VARCHAR(512) NOT NULL,
    `manual_context` TEXT NULL,
    `origin_email` VARCHAR(320) NULL,
    `origin_subject` VARCHAR(998) NULL,
    `origin_thread_context` TEXT NULL,
    `last_processed_at` DATETIME(3) NULL,
    `failure_reason` TEXT NULL,
    `bull_job_id` VARCHAR(128) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rfq_analysis_sources` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `kind` ENUM('FILE', 'EMAIL_BODY', 'THREAD_CONTEXT', 'MANUAL_NOTE') NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `file_name` VARCHAR(512) NULL,
    `mime_type` VARCHAR(255) NULL,
    `storage_path` VARCHAR(1024) NULL,
    `extracted_text` LONGTEXT NULL,
    `extraction_status` ENUM('PENDING', 'OK', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `extraction_error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rfq_analysis_insights` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `executive_summary` TEXT NULL,
    `opportunity_type` VARCHAR(512) NULL,
    `detected_technologies` JSON NULL,
    `avvale_areas` JSON NULL,
    `functional_vision` TEXT NULL,
    `technical_vision` TEXT NULL,
    `risks_and_unknowns` TEXT NULL,
    `recommended_questions` JSON NULL,
    `confidence_notes` TEXT NULL,
    `raw_model_output` LONGTEXT NULL,
    `synthesis_model_id` VARCHAR(128) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rfq_analysis_messages` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ASSISTANT', 'SYSTEM') NOT NULL,
    `content` LONGTEXT NOT NULL,
    `metadata` JSON NULL,
    `model_id` VARCHAR(128) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rfq_analysis_job_events` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `phase` ENUM('INGEST', 'EXTRACT', 'NORMALIZE', 'SYNTHESIZE') NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `detail` JSON NULL,
    `model_id` VARCHAR(128) NULL,
    `prompt_hash` VARCHAR(64) NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `rfq_analyses_user_id_idx` ON `rfq_analyses`(`user_id`);

-- CreateIndex
CREATE INDEX `rfq_analyses_status_idx` ON `rfq_analyses`(`status`);

-- AddForeignKey
ALTER TABLE `rfq_analyses` ADD CONSTRAINT `rfq_analyses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rfq_analysis_sources` ADD CONSTRAINT `rfq_analysis_sources_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `rfq_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `rfq_analysis_sources_analysis_id_idx` ON `rfq_analysis_sources`(`analysis_id`);

-- AddForeignKey
ALTER TABLE `rfq_analysis_insights` ADD CONSTRAINT `rfq_analysis_insights_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `rfq_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `rfq_analysis_insights_analysis_id_idx` ON `rfq_analysis_insights`(`analysis_id`);

-- AddForeignKey
ALTER TABLE `rfq_analysis_messages` ADD CONSTRAINT `rfq_analysis_messages_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `rfq_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `rfq_analysis_messages_analysis_id_idx` ON `rfq_analysis_messages`(`analysis_id`);

-- AddForeignKey
ALTER TABLE `rfq_analysis_job_events` ADD CONSTRAINT `rfq_analysis_job_events_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `rfq_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `rfq_analysis_job_events_analysis_id_idx` ON `rfq_analysis_job_events`(`analysis_id`);
