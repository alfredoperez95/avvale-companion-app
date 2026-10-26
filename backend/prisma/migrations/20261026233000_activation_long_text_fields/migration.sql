-- Nombres de HubSpot, asunto compuesto y URLs superan VARCHAR(191).
-- Prisma lanzaba P2000 y el filtro de producción lo devolvía como "Error interno" en POST /activations.
ALTER TABLE `activations`
  MODIFY COLUMN `subject` TEXT NOT NULL,
  MODIFY COLUMN `project_name` TEXT NOT NULL,
  MODIFY COLUMN `client` TEXT NULL,
  MODIFY COLUMN `offer_code` TEXT NOT NULL,
  MODIFY COLUMN `project_amount` TEXT NULL,
  MODIFY COLUMN `hubspot_url` TEXT NULL,
  MODIFY COLUMN `yubiq_as_id` TEXT NULL,
  MODIFY COLUMN `project_jp_name` TEXT NULL,
  MODIFY COLUMN `project_jp_email` TEXT NULL;
