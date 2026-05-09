-- KYC: footprint Avvale, proyectos y presencia por línea de solución (JSON).
ALTER TABLE `kyc_profiles` ADD COLUMN `avvale` JSON NOT NULL DEFAULT (JSON_OBJECT());
