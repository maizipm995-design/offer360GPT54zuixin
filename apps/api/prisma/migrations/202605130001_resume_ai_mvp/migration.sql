-- CreateTable
CREATE TABLE `ai_model_configs` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `provider` VARCHAR(30) NOT NULL,
    `config_name` VARCHAR(80) NOT NULL,
    `base_url` VARCHAR(255) NOT NULL,
    `api_key_encrypted` TEXT NOT NULL,
    `api_key_mask` VARCHAR(80) NULL,
    `model_name` VARCHAR(100) NOT NULL,
    `endpoint_type` VARCHAR(30) NOT NULL DEFAULT 'responses',
    `timeout_ms` INTEGER NOT NULL DEFAULT 15000,
    `max_output_tokens` INTEGER NULL,
    `temperature` DECIMAL(4, 2) NULL,
    `top_p` DECIMAL(4, 2) NULL,
    `system_prompt` LONGTEXT NULL,
    `global_prompt_template` LONGTEXT NULL,
    `entry_prompt_template` LONGTEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `uk_ai_model_config_code`(`code`),
    INDEX `idx_ai_model_configs_provider_enabled`(`provider`, `enabled`),
    INDEX `idx_ai_model_configs_is_default`(`is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resume_ai_optimization_logs` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `resume_id` CHAR(36) NOT NULL,
    `provider` VARCHAR(30) NOT NULL,
    `model_name` VARCHAR(100) NOT NULL,
    `optimize_type` VARCHAR(20) NOT NULL,
    `section_id` VARCHAR(50) NOT NULL,
    `entry_id` VARCHAR(50) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'processing',
    `request_payload` JSON NULL,
    `response_payload` JSON NULL,
    `before_content` JSON NULL,
    `after_content` JSON NULL,
    `response_text` LONGTEXT NULL,
    `error_code` VARCHAR(50) NULL,
    `error_message` VARCHAR(255) NULL,
    `input_tokens` INTEGER NULL,
    `output_tokens` INTEGER NULL,
    `latency_ms` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_resume_ai_logs_user_created`(`user_id`, `created_at`),
    INDEX `idx_resume_ai_logs_resume_created`(`resume_id`, `created_at`),
    INDEX `idx_resume_ai_logs_status_created`(`status`, `created_at`),
    INDEX `idx_resume_ai_logs_section_entry`(`section_id`, `entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `resume_ai_optimization_logs` ADD CONSTRAINT `resume_ai_optimization_logs_user_id_fkey`
FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resume_ai_optimization_logs` ADD CONSTRAINT `resume_ai_optimization_logs_resume_id_fkey`
FOREIGN KEY (`resume_id`) REFERENCES `resume_drafts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
