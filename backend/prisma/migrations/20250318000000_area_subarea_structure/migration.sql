-- AlterTable: add director fields to areas
ALTER TABLE `areas` ADD COLUMN `director_name` VARCHAR(191) NULL,
    ADD COLUMN `director_email` VARCHAR(191) NULL;

-- CreateTable sub_areas
CREATE TABLE `sub_areas` (
    `id` VARCHAR(191) NOT NULL,
    `area_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable sub_area_contacts
CREATE TABLE `sub_area_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `sub_area_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate: create default subarea "General" per area
INSERT INTO `sub_areas` (`id`, `area_id`, `name`, `created_at`)
SELECT UUID(), `id`, 'General', NOW(3) FROM `areas`;

-- Move existing area_contacts into sub_area_contacts (under General subarea)

INSERT INTO `sub_area_contacts` (`id`, `sub_area_id`, `name`, `email`)
SELECT ac.`id`, sa.`id`, ac.`name`, ac.`email`
FROM `area_contacts` ac
JOIN `sub_areas` sa ON sa.`area_id` = ac.`area_id` AND sa.`name` = 'General';

-- DropTable area_contacts
DROP TABLE `area_contacts`;

-- AddForeignKey sub_areas -> areas
ALTER TABLE `sub_areas` ADD CONSTRAINT `sub_areas_area_id_fkey` FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey sub_area_contacts -> sub_areas
ALTER TABLE `sub_area_contacts` ADD CONSTRAINT `sub_area_contacts_sub_area_id_fkey` FOREIGN KEY (`sub_area_id`) REFERENCES `sub_areas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
