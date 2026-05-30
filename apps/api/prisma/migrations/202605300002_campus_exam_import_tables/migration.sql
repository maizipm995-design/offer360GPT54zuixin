CREATE TABLE `campus_exam_import_batches` (
  `id` CHAR(36) NOT NULL,
  `special_id` INTEGER NOT NULL,
  `file_name` VARCHAR(191) NOT NULL,
  `uploaded_by_admin_id` CHAR(36) NOT NULL,
  `total_count` INTEGER NOT NULL DEFAULT 0,
  `success_count` INTEGER NOT NULL DEFAULT 0,
  `fail_count` INTEGER NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'uploaded',
  `summary_json` JSON NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_campus_exam_import_batches_special_created`(`special_id`, `created_at`),
  INDEX `idx_campus_exam_import_batches_status_created`(`status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campus_exam_import_errors` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `batch_id` CHAR(36) NOT NULL,
  `row_no` INTEGER NOT NULL,
  `field_name` VARCHAR(100) NOT NULL,
  `error_code` VARCHAR(50) NOT NULL,
  `error_message` VARCHAR(500) NOT NULL,
  `raw_payload` JSON NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_campus_exam_import_errors_batch_row`(`batch_id`, `row_no`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `campus_exam_import_batches`
  ADD CONSTRAINT `campus_exam_import_batches_special_id_fkey`
  FOREIGN KEY (`special_id`) REFERENCES `campus_exam_specials`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `campus_exam_import_errors`
  ADD CONSTRAINT `campus_exam_import_errors_batch_id_fkey`
  FOREIGN KEY (`batch_id`) REFERENCES `campus_exam_import_batches`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `campus_exam_questions`
  ADD CONSTRAINT `campus_exam_questions_import_batch_id_fkey`
  FOREIGN KEY (`import_batch_id`) REFERENCES `campus_exam_import_batches`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
