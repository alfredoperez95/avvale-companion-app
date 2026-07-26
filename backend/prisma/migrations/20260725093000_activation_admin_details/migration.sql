-- Detalles administrativos en activaciones: PFE, Pedido, Yubiq A&S
ALTER TABLE `activations`
  ADD COLUMN `pfe` ENUM('SI', 'NO') NULL,
  ADD COLUMN `pedido` ENUM('SI', 'NO', 'PENDIENTE') NULL,
  ADD COLUMN `yubiq_as_url` TEXT NULL;
