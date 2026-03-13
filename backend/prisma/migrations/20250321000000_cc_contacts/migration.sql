-- CreateTable cc_contacts (catálogo para autocompletado del campo CC)
CREATE TABLE `cc_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed 5 contactos de ejemplo (xxxx.xxxx@avvale.com)
INSERT INTO `cc_contacts` (`id`, `name`, `email`, `created_at`) VALUES
(UUID(), 'Contacto CC 1', 'contacto1.avvale@avvale.com', CURRENT_TIMESTAMP(3)),
(UUID(), 'Contacto CC 2', 'contacto2.avvale@avvale.com', CURRENT_TIMESTAMP(3)),
(UUID(), 'Contacto CC 3', 'contacto3.avvale@avvale.com', CURRENT_TIMESTAMP(3)),
(UUID(), 'Contacto CC 4', 'contacto4.avvale@avvale.com', CURRENT_TIMESTAMP(3)),
(UUID(), 'Contacto CC 5', 'contacto5.avvale@avvale.com', CURRENT_TIMESTAMP(3));
