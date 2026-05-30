ALTER TABLE `campus_exam_categories`
  MODIFY `updated_at` DATETIME(0) NOT NULL;

ALTER TABLE `campus_exam_specials`
  MODIFY `updated_at` DATETIME(0) NOT NULL;

ALTER TABLE `campus_exam_questions`
  MODIFY `updated_at` DATETIME(0) NOT NULL;

ALTER TABLE `campus_exam_import_batches`
  MODIFY `updated_at` DATETIME(0) NOT NULL;

ALTER TABLE `campus_exam_practice_sessions`
  MODIFY `updated_at` DATETIME(0) NOT NULL;

ALTER TABLE `campus_exam_practice_answers`
  MODIFY `updated_at` DATETIME(0) NOT NULL;

ALTER TABLE `campus_exam_notes`
  MODIFY `updated_at` DATETIME(0) NOT NULL;
