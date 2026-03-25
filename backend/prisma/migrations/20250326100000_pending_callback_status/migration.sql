-- READY_TO_SEND → PENDING_CALLBACK (mismo significado operativo, nombre más claro)
UPDATE `activations` SET `status` = 'PENDING_CALLBACK' WHERE `status` = 'READY_TO_SEND';

ALTER TABLE `activations` MODIFY COLUMN `status` ENUM(
  'DRAFT',
  'PENDING_CALLBACK',
  'SENT',
  'QUEUED',
  'PROCESSING',
  'RETRYING',
  'FAILED'
) NOT NULL DEFAULT 'DRAFT';
