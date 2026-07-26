-- ID de documento/item Yubiq Approve & Seal junto a la URL
ALTER TABLE `activations`
  ADD COLUMN `yubiq_as_id` VARCHAR(191) NULL;
