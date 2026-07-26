CREATE TABLE `sw_form_catalog_items` (
    `id` VARCHAR(191) NOT NULL,
    `tipo_sw` VARCHAR(180) NOT NULL,
    `practica` VARCHAR(80) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sw_form_catalog_items_tipo_sw_key`(`tipo_sw`),
    INDEX `sw_form_catalog_items_sort_order_idx`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
