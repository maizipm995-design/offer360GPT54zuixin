ALTER TABLE `job_announcement_access_logs`
  ADD COLUMN `review_status` VARCHAR(30) NOT NULL DEFAULT 'not_required' AFTER `risk_hit`,
  ADD COLUMN `review_conclusion` VARCHAR(50) NULL AFTER `review_status`,
  ADD COLUMN `review_note` VARCHAR(500) NULL AFTER `review_conclusion`,
  ADD COLUMN `reviewed_by_admin_user_id` CHAR(36) NULL AFTER `review_note`,
  ADD COLUMN `reviewed_at` DATETIME NULL AFTER `reviewed_by_admin_user_id`;

CREATE INDEX `idx_job_access_logs_review_status_created`
  ON `job_announcement_access_logs`(`review_status`, `created_at`);

ALTER TABLE `job_announcement_access_logs`
  ADD CONSTRAINT `job_announcement_access_logs_reviewed_by_admin_user_id_fkey`
  FOREIGN KEY (`reviewed_by_admin_user_id`) REFERENCES `admin_users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
