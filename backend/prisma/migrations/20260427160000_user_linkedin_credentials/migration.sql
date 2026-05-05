-- User LinkedIn credentials (cookies cifradas por usuario).
-- Equivalente al patrón de user_anthropic_credentials, pero para Playwright cookies.

CREATE TABLE `user_linkedin_credentials` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `cookies_ciphertext` LONGTEXT NOT NULL,
    `cookies_iv` TEXT NOT NULL,
    `cookies_tag` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_linkedin_credentials_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_linkedin_credentials`
ADD CONSTRAINT `user_linkedin_credentials_user_id_fkey`
FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

