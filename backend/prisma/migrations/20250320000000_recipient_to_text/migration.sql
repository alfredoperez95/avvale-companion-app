-- recipient_to y recipient_cc pueden ser listas largas de emails; pasar de VARCHAR(191) a TEXT
ALTER TABLE `activations` MODIFY COLUMN `recipient_to` TEXT NOT NULL;
ALTER TABLE `activations` MODIFY COLUMN `recipient_cc` TEXT NULL;
