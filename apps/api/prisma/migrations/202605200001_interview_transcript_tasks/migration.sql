CREATE TABLE `interview_transcript_tasks` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NULL,
  `company_name` varchar(191) NOT NULL,
  `job_name` varchar(191) NOT NULL,
  `interview_type` varchar(50) NOT NULL,
  `job_requirement` text NOT NULL,
  `resume_mode` varchar(20) NOT NULL,
  `structured_resume_title` varchar(191) NULL,
  `uploaded_file_name` varchar(191) NULL,
  `status` varchar(20) NOT NULL DEFAULT 'processing',
  `output_mode` varchar(20) NULL,
  `download_url` text NULL,
  `final_output` longtext NULL,
  `error_message` varchar(255) NULL,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_interview_transcript_tasks_user_updated`(`user_id`, `updated_at`),
  INDEX `idx_interview_transcript_tasks_status_updated`(`status`, `updated_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `interview_transcript_tasks`
  ADD CONSTRAINT `interview_transcript_tasks_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
