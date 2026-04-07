-- Texto libre anterior: los valores no encajan en el nuevo catálogo; se limpian para poder aplicar el ENUM.
UPDATE `users` SET `position` = NULL;

-- AlterTable
ALTER TABLE `users` MODIFY COLUMN `position` ENUM(
  'GROWTH_MANAGING_DIRECTOR',
  'INDUSTRY_DIRECTOR',
  'ACCOUNT_MANAGER'
) NULL;
