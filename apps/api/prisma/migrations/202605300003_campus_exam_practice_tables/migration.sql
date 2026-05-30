CREATE TABLE `campus_exam_practice_sessions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `mode` VARCHAR(30) NOT NULL,
  `special_id` INTEGER NULL,
  `title` VARCHAR(191) NOT NULL,
  `total_questions` INTEGER NOT NULL DEFAULT 0,
  `answered_count` INTEGER NOT NULL DEFAULT 0,
  `correct_count` INTEGER NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ongoing',
  `last_question_id` CHAR(36) NULL,
  `question_order_json` JSON NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_campus_exam_sessions_user_updated`(`user_id`, `updated_at`),
  INDEX `idx_campus_exam_sessions_special_updated`(`special_id`, `updated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campus_exam_practice_answers` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `session_id` CHAR(36) NOT NULL,
  `question_id` CHAR(36) NOT NULL,
  `user_answer_json` JSON NULL,
  `is_correct` BOOLEAN NULL,
  `score` DECIMAL(5, 2) NULL,
  `answer_status` VARCHAR(20) NOT NULL DEFAULT 'unanswered',
  `used_time_sec` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  UNIQUE INDEX `uniq_campus_exam_practice_answers_session_question`(`session_id`, `question_id`),
  INDEX `idx_campus_exam_practice_answers_question_created`(`question_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campus_exam_wrong_questions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` CHAR(36) NOT NULL,
  `question_id` CHAR(36) NOT NULL,
  `source_answer_id` BIGINT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  UNIQUE INDEX `uniq_campus_exam_wrong_questions_user_question`(`user_id`, `question_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campus_exam_favorites` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` CHAR(36) NOT NULL,
  `question_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  UNIQUE INDEX `uniq_campus_exam_favorites_user_question`(`user_id`, `question_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campus_exam_notes` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` CHAR(36) NOT NULL,
  `question_id` CHAR(36) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_campus_exam_notes_user_updated`(`user_id`, `updated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `campus_exam_practice_sessions`
  ADD CONSTRAINT `campus_exam_practice_sessions_special_id_fkey`
  FOREIGN KEY (`special_id`) REFERENCES `campus_exam_specials`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `campus_exam_practice_answers`
  ADD CONSTRAINT `campus_exam_practice_answers_session_id_fkey`
  FOREIGN KEY (`session_id`) REFERENCES `campus_exam_practice_sessions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `campus_exam_practice_answers`
  ADD CONSTRAINT `campus_exam_practice_answers_question_id_fkey`
  FOREIGN KEY (`question_id`) REFERENCES `campus_exam_questions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `campus_exam_wrong_questions`
  ADD CONSTRAINT `campus_exam_wrong_questions_question_id_fkey`
  FOREIGN KEY (`question_id`) REFERENCES `campus_exam_questions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `campus_exam_favorites`
  ADD CONSTRAINT `campus_exam_favorites_question_id_fkey`
  FOREIGN KEY (`question_id`) REFERENCES `campus_exam_questions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `campus_exam_notes`
  ADD CONSTRAINT `campus_exam_notes_question_id_fkey`
  FOREIGN KEY (`question_id`) REFERENCES `campus_exam_questions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
