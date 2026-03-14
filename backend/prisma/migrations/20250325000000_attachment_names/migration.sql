-- AlterTable: add attachment_names (JSON array of file names, same order as attachment_urls)
ALTER TABLE `activations` ADD COLUMN `attachment_names` TEXT NULL;
