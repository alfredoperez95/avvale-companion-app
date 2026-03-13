-- CreateTable activation_sub_areas (selección de subáreas concretas en una activación)
CREATE TABLE `activation_sub_areas` (
    `activation_id` VARCHAR(191) NOT NULL,
    `sub_area_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`activation_id`, `sub_area_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `activation_sub_areas` ADD CONSTRAINT `activation_sub_areas_activation_id_fkey` FOREIGN KEY (`activation_id`) REFERENCES `activations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `activation_sub_areas` ADD CONSTRAINT `activation_sub_areas_sub_area_id_fkey` FOREIGN KEY (`sub_area_id`) REFERENCES `sub_areas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
