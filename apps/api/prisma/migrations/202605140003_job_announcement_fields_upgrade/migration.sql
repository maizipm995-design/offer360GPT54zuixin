ALTER TABLE `job_announcements`
  CHANGE COLUMN `job_category` `major_requirement` TEXT NULL,
  MODIFY COLUMN `deadline_at` VARCHAR(20) NULL,
  MODIFY COLUMN `graduation_session` VARCHAR(50) NULL,
  MODIFY COLUMN `referral_code` VARCHAR(100) NULL,
  MODIFY COLUMN `entry_date` VARCHAR(20) NULL;
