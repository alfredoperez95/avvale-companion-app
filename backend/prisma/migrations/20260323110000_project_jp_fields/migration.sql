ALTER TABLE `sub_area_contacts`
  ADD COLUMN `is_project_jp` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `cc_contacts`
  ADD COLUMN `is_project_jp` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `activations`
  ADD COLUMN `project_jp_name` VARCHAR(191) NULL,
  ADD COLUMN `project_jp_email` VARCHAR(191) NULL,
  ADD COLUMN `project_jp_source` VARCHAR(191) NULL;
