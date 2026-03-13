-- AlterTable activations: add project_amount and project_type (Consultoría / SW)
ALTER TABLE `activations` ADD COLUMN `project_amount` VARCHAR(191) NULL,
    ADD COLUMN `project_type` ENUM('CONSULTORIA', 'SW') NULL;
