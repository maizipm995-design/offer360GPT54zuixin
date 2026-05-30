CREATE TABLE `campus_exam_categories` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `description` VARCHAR(500) NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  UNIQUE INDEX `campus_exam_categories_slug_key`(`slug`),
  INDEX `idx_campus_exam_categories_status_sort`(`status`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campus_exam_specials` (
  `id` INTEGER NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(500) NULL,
  `question_count` INTEGER NOT NULL DEFAULT 0,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_campus_exam_specials_category_sort`(`category_id`, `sort_order`),
  INDEX `idx_campus_exam_specials_status_sort`(`status`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campus_exam_questions` (
  `id` CHAR(36) NOT NULL,
  `special_id` INTEGER NOT NULL,
  `question_type` INTEGER NOT NULL,
  `stem_content_type` INTEGER NOT NULL DEFAULT 1,
  `difficulty` INTEGER NOT NULL DEFAULT 3,
  `is_high_frequency_wrong` BOOLEAN NOT NULL DEFAULT false,
  `option_content_type` INTEGER NULL,
  `stem_html` LONGTEXT NOT NULL,
  `options_json` JSON NULL,
  `answer_json` JSON NOT NULL,
  `analysis_html` LONGTEXT NULL,
  `question_image_url` TEXT NULL,
  `analysis_image_url` TEXT NULL,
  `question_image_oss_url` TEXT NULL,
  `analysis_image_oss_url` TEXT NULL,
  `inline_asset_json` JSON NULL,
  `source_row_no` INTEGER NULL,
  `import_batch_id` CHAR(36) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_campus_exam_questions_special_status_created`(`special_id`, `status`, `created_at`),
  INDEX `idx_campus_exam_questions_type_difficulty`(`question_type`, `difficulty`),
  INDEX `idx_campus_exam_questions_batch`(`import_batch_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `campus_exam_specials`
  ADD CONSTRAINT `campus_exam_specials_category_id_fkey`
  FOREIGN KEY (`category_id`) REFERENCES `campus_exam_categories`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `campus_exam_questions`
  ADD CONSTRAINT `campus_exam_questions_special_id_fkey`
  FOREIGN KEY (`special_id`) REFERENCES `campus_exam_specials`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
