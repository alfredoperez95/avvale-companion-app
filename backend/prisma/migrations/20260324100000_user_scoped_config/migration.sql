-- Áreas: propietario null = sistema
ALTER TABLE `areas` ADD COLUMN `owner_user_id` VARCHAR(191) NULL;

CREATE INDEX `areas_owner_user_id_idx` ON `areas`(`owner_user_id`);

ALTER TABLE `areas` ADD CONSTRAINT `areas_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Plantillas: user_id null = del sistema
ALTER TABLE `email_templates` ADD COLUMN `user_id` VARCHAR(191) NULL;

CREATE INDEX `email_templates_user_id_idx` ON `email_templates`(`user_id`);

ALTER TABLE `email_templates` ADD CONSTRAINT `email_templates_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Firma: una fila por usuario (tras script, sin filas huérfanas)
ALTER TABLE `email_signature` ADD COLUMN `user_id` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `email_signature_user_id_key` ON `email_signature`(`user_id`);

ALTER TABLE `email_signature` ADD CONSTRAINT `email_signature_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
