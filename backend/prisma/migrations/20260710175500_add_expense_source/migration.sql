ALTER TABLE `expenses`
  ADD COLUMN `source` ENUM('manual', 'email') NOT NULL DEFAULT 'manual';
