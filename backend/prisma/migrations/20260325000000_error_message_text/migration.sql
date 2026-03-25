-- Make `error_message` suficientemente grande para mensajes de error largos.
-- Evita P2000 ("value too long") al guardar errores desde BullMQ.
ALTER TABLE `activations`
  MODIFY COLUMN `error_message` TEXT NULL;

