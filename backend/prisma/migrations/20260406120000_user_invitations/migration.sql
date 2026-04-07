-- CreateTable
CREATE TABLE `user_invitations` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `position` ENUM('GROWTH_MANAGING_DIRECTOR', 'INDUSTRY_DIRECTOR', 'ACCOUNT_MANAGER') NULL,
    `industry` ENUM('ENERGY_PUBLIC_SECTOR', 'CONSUMER_MARKETS', 'LIFESTYLE_SERVICES', 'INDUSTRIAL_CORPORATE_MARKETS') NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `token_hash` VARCHAR(64) NOT NULL,
    `invited_by_user_id` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_invitations_email_key`(`email`),
    UNIQUE INDEX `user_invitations_token_hash_key`(`token_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_invitations` ADD CONSTRAINT `user_invitations_invited_by_user_id_fkey` FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
