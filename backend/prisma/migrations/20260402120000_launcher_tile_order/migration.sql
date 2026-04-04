-- Orden de mosaicos App Launcher por usuario
ALTER TABLE `users` ADD COLUMN `launcher_tile_order` JSON NULL;
