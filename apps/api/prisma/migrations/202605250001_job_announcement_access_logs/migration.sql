CREATE TABLE `job_announcement_access_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `job_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `membership_id` CHAR(36) NULL,
  `member_level` VARCHAR(30) NULL,
  `action` VARCHAR(40) NOT NULL,
  `request_status` VARCHAR(30) NOT NULL DEFAULT 'issued',
  `access_token_id` CHAR(36) NULL,
  `redirect_target_type` VARCHAR(30) NULL,
  `limit_hit` BOOLEAN NOT NULL DEFAULT false,
  `risk_hit` BOOLEAN NOT NULL DEFAULT false,
  `ip` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `device_id` VARCHAR(100) NULL,
  `session_id` VARCHAR(100) NULL,
  `failure_reason` VARCHAR(255) NULL,
  `consumed_at` DATETIME NULL,
  `expires_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL,
  UNIQUE INDEX `job_announcement_access_logs_access_token_id_key`(`access_token_id`),
  INDEX `idx_job_access_logs_job_created`(`job_id`, `created_at`),
  INDEX `idx_job_access_logs_user_created`(`user_id`, `created_at`),
  INDEX `idx_job_access_logs_status_created`(`request_status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `job_announcement_access_logs_job_id_fkey`
    FOREIGN KEY (`job_id`) REFERENCES `job_announcements`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `job_announcement_access_logs_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
