-- KYC: tablas kyc_* (equivalente lógico a services/kyc/init.sql, sin usuarios de auth KYC).
-- Generado y revisado a partir de prisma migrate diff; defaults JSON alineados con @default en schema.

-- CreateTable
CREATE TABLE `kyc_companies` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `sector` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL DEFAULT 'Spain',
    `website` VARCHAR(191) NULL,
    `revenue` VARCHAR(191) NULL,
    `employees` VARCHAR(191) NULL,
    `tech_stack` VARCHAR(191) NULL,
    `source` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `kyc_companies_name_idx`(`name`),
    INDEX `kyc_companies_sector_idx`(`sector`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_contacts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `job_title` VARCHAR(191) NULL,
    `linkedin` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `kyc_contacts_company_id_idx`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_profiles` (
    `company_id` BIGINT NOT NULL,
    `economics` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `business_model` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `customers` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `tech_stack` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `critical_processes` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `sector_context` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `summary` TEXT NULL,
    `confidence_score` INTEGER NULL DEFAULT 0,
    `strategic` BOOLEAN NOT NULL DEFAULT false,
    `last_enriched_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `kyc_profiles_strategic_idx`(`strategic`),
    PRIMARY KEY (`company_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_org_members` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `contact_id` BIGINT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NULL,
    `area` VARCHAR(191) NULL,
    `level` INTEGER NULL,
    `reports_to_id` BIGINT NULL,
    `linkedin` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `source` VARCHAR(191) NULL DEFAULT 'manual',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `kyc_org_members_company_id_idx`(`company_id`),
    INDEX `kyc_org_members_reports_to_id_idx`(`reports_to_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_org_relationships` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `from_member_id` BIGINT NOT NULL,
    `to_member_id` BIGINT NOT NULL,
    `type` ENUM('aliado', 'bloqueador', 'influencer', 'mentor', 'rival', 'otro') NOT NULL,
    `strength` INTEGER NULL DEFAULT 3,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kyc_org_relationships_company_id_idx`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_signals` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `source_url` TEXT NULL,
    `sentiment` ENUM('positive', 'neutral', 'negative', 'mixed') NULL,
    `rating` DECIMAL(3, 1) NULL,
    `title` TEXT NULL,
    `text` TEXT NULL,
    `signal_type` VARCHAR(191) NULL DEFAULT 'review',
    `published_at` DATETIME(3) NULL,
    `captured_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kyc_signals_company_id_captured_at_idx`(`company_id`, `captured_at` DESC),
    INDEX `kyc_signals_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_chat_sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `workdir` TEXT NULL,
    `session_type` ENUM('research', 'intake') NOT NULL DEFAULT 'research',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `kyc_chat_sessions_company_id_updated_at_idx`(`company_id`, `updated_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_chat_messages` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `session_id` BIGINT NOT NULL,
    `role` ENUM('user', 'assistant', 'system', 'tool') NOT NULL,
    `content` LONGTEXT NOT NULL,
    `meta` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kyc_chat_messages_session_id_id_idx`(`session_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_facts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `field_path` VARCHAR(191) NOT NULL,
    `value` JSON NULL,
    `prev_value` JSON NULL,
    `source` VARCHAR(191) NOT NULL,
    `source_ref` TEXT NULL,
    `confidence` DECIMAL(3, 2) NULL,
    `user_id` VARCHAR(191) NULL,
    `chat_message_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kyc_facts_company_id_created_at_idx`(`company_id`, `created_at` DESC),
    INDEX `kyc_facts_company_id_field_path_idx`(`company_id`, `field_path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_open_questions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `topic` VARCHAR(191) NOT NULL,
    `question` TEXT NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 2,
    `status` ENUM('open', 'resolved', 'skipped') NOT NULL DEFAULT 'open',
    `answer` TEXT NULL,
    `source` VARCHAR(191) NULL DEFAULT 'intake',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,

    INDEX `kyc_open_questions_company_id_status_priority_idx`(`company_id`, `status`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `kyc_contacts` ADD CONSTRAINT `kyc_contacts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `kyc_companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_profiles` ADD CONSTRAINT `kyc_profiles_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `kyc_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_org_members` ADD CONSTRAINT `kyc_org_members_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `kyc_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_org_members` ADD CONSTRAINT `kyc_org_members_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `kyc_contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_org_members` ADD CONSTRAINT `kyc_org_members_reports_to_id_fkey` FOREIGN KEY (`reports_to_id`) REFERENCES `kyc_org_members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_org_relationships` ADD CONSTRAINT `kyc_org_relationships_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `kyc_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_org_relationships` ADD CONSTRAINT `kyc_org_relationships_from_member_id_fkey` FOREIGN KEY (`from_member_id`) REFERENCES `kyc_org_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_org_relationships` ADD CONSTRAINT `kyc_org_relationships_to_member_id_fkey` FOREIGN KEY (`to_member_id`) REFERENCES `kyc_org_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_signals` ADD CONSTRAINT `kyc_signals_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `kyc_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_chat_sessions` ADD CONSTRAINT `kyc_chat_sessions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `kyc_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_chat_sessions` ADD CONSTRAINT `kyc_chat_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_chat_messages` ADD CONSTRAINT `kyc_chat_messages_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `kyc_chat_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_facts` ADD CONSTRAINT `kyc_facts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `kyc_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_facts` ADD CONSTRAINT `kyc_facts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_facts` ADD CONSTRAINT `kyc_facts_chat_message_id_fkey` FOREIGN KEY (`chat_message_id`) REFERENCES `kyc_chat_messages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_open_questions` ADD CONSTRAINT `kyc_open_questions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `kyc_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
