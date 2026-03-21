-- CreateColumn (nullable first for backfill)
ALTER TABLE `activations` ADD COLUMN `activation_number` INTEGER UNSIGNED NULL;

-- Stable sequential numbers by creation time (oldest = 1)
SET @r = 0;
UPDATE `activations` SET `activation_number` = (@r := @r + 1) ORDER BY `created_at` ASC;

-- NOT NULL, then UNIQUE index, then AUTO_INCREMENT (secondary AI must be UNIQUE in MySQL/MariaDB)
ALTER TABLE `activations` MODIFY COLUMN `activation_number` INTEGER UNSIGNED NOT NULL;

ALTER TABLE `activations` ADD UNIQUE INDEX `activations_activation_number_key` (`activation_number`);

ALTER TABLE `activations` MODIFY COLUMN `activation_number` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT;
