ALTER TABLE `campus_exam_categories`
  ADD COLUMN `special_code` VARCHAR(32) NULL AFTER `id`;

ALTER TABLE `campus_exam_specials`
  ADD COLUMN `special_code` VARCHAR(32) NULL AFTER `id`;

UPDATE `campus_exam_categories`
SET `special_code` = CONCAT('CAT', UPPER(SUBSTRING(MD5(CONCAT('campus-category-', `id`)), 1, 12)))
WHERE `special_code` IS NULL OR `special_code` = '';

UPDATE `campus_exam_specials`
SET `special_code` = CONCAT('SP', UPPER(SUBSTRING(MD5(CONCAT('campus-special-', `id`)), 1, 12)))
WHERE `special_code` IS NULL OR `special_code` = '';

ALTER TABLE `campus_exam_categories`
  MODIFY COLUMN `special_code` VARCHAR(32) NOT NULL,
  ADD UNIQUE INDEX `campus_exam_categories_special_code_key` (`special_code`);

ALTER TABLE `campus_exam_specials`
  MODIFY COLUMN `special_code` VARCHAR(32) NOT NULL,
  ADD UNIQUE INDEX `campus_exam_specials_special_code_key` (`special_code`);
