CREATE TABLE `campus_exam_subjective_judgements` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `answer_id` BIGINT NOT NULL,
  `question_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `scoring_mode` VARCHAR(30) NOT NULL,
  `matched_keywords_json` JSON NULL,
  `reference_answer_snapshot` LONGTEXT NOT NULL,
  `user_answer_snapshot` LONGTEXT NOT NULL,
  `raw_score` DECIMAL(5, 2) NOT NULL,
  `normalized_score` DECIMAL(5, 2) NOT NULL,
  `judgement_result` VARCHAR(20) NOT NULL,
  `ai_model_code` VARCHAR(50) NULL,
  `ai_reasoning` LONGTEXT NULL,
  `quality_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `quality_note` VARCHAR(500) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_campus_exam_subjective_judgements_answer`(`answer_id`),
  INDEX `idx_campus_exam_subjective_judgements_question_created`(`question_id`, `created_at`),
  INDEX `idx_campus_exam_subjective_judgements_quality_created`(`quality_status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `campus_exam_subjective_judgements`
  ADD CONSTRAINT `campus_exam_subjective_judgements_answer_id_fkey`
  FOREIGN KEY (`answer_id`) REFERENCES `campus_exam_practice_answers`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `campus_exam_subjective_judgements`
  ADD CONSTRAINT `campus_exam_subjective_judgements_question_id_fkey`
  FOREIGN KEY (`question_id`) REFERENCES `campus_exam_questions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
