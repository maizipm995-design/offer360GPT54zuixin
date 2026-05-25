-- CreateTable
CREATE TABLE `resume_ai_suggestions` (
    `id` CHAR(36) NOT NULL,
    `resume_id` CHAR(36) NOT NULL,
    `section_id` VARCHAR(50) NOT NULL,
    `entry_id` VARCHAR(50) NOT NULL,
    `suggestions` JSON NOT NULL,
    `content_hash` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_resume_ai_suggestions_resume_updated`(`resume_id`, `updated_at`),
    UNIQUE INDEX `uk_resume_ai_suggestions_resume_section_entry`(`resume_id`, `section_id`, `entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `resume_ai_suggestions` ADD CONSTRAINT `resume_ai_suggestions_resume_id_fkey` FOREIGN KEY (`resume_id`) REFERENCES `resume_drafts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
