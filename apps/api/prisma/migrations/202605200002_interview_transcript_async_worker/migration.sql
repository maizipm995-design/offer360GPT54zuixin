ALTER TABLE `interview_transcript_tasks`
  ADD COLUMN `workflow_input` longtext NULL AFTER `resume_mode`,
  ADD COLUMN `uploaded_file_path` text NULL AFTER `uploaded_file_name`,
  ADD COLUMN `uploaded_file_content_type` varchar(191) NULL AFTER `uploaded_file_path`,
  ADD COLUMN `processing_attempt_count` int NOT NULL DEFAULT 0 AFTER `status`,
  ADD COLUMN `processing_started_at` datetime(0) NULL AFTER `processing_attempt_count`;
