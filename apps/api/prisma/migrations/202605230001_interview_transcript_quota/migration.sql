ALTER TABLE `users`
  ADD COLUMN `interview_transcript_free_count` int NOT NULL DEFAULT 1 AFTER `resume_pdf_export_count`,
  ADD COLUMN `interview_transcript_super_count` int NOT NULL DEFAULT 0 AFTER `interview_transcript_free_count`;

ALTER TABLE `interview_transcript_tasks`
  ADD COLUMN `quota_type` varchar(20) NULL AFTER `status`;
