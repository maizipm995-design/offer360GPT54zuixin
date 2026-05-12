CREATE DATABASE IF NOT EXISTS `offer360` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `offer360`;















-- CreateTable
CREATE TABLE `job_announcements` (
    `id` CHAR(36) NOT NULL,
    `company_full_name` VARCHAR(191) NOT NULL,
    `enterprise_nature` VARCHAR(50) NULL,
    `degree_requirement` VARCHAR(50) NULL,
    `work_location` LONGTEXT NULL,
    `job_name` TEXT NULL,
    `job_category` TEXT NULL,
    `recruitment_type` VARCHAR(50) NULL,
    `deadline_at` TEXT NULL,
    `announcement_url` TEXT NULL,
    `delivery_url` TEXT NULL,
    `graduation_session` LONGTEXT NULL,
    `referral_code` TEXT NULL,
    `announcement_title` VARCHAR(255) NULL,
    `industry` VARCHAR(100) NULL,
    `entry_date` TEXT NULL,
    `access_click_count` INTEGER NOT NULL DEFAULT 0,
    `delivery_mark_count` INTEGER NOT NULL DEFAULT 0,
    `last_access_at` DATETIME(0) NULL,
    `last_delivery_mark_at` DATETIME(0) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'published',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_jobs_company_full_name`(`company_full_name`),
    INDEX `idx_jobs_degree`(`degree_requirement`),
    INDEX `idx_jobs_nature`(`enterprise_nature`),
    INDEX `idx_jobs_recruitment_type`(`recruitment_type`),
    INDEX `idx_jobs_updated_at`(`updated_at`),
    INDEX `idx_jobs_status_updated_at`(`status`, `updated_at`),
    INDEX `idx_jobs_delivery_mark_updated_at`(`delivery_mark_count`, `updated_at`),
    INDEX `idx_jobs_access_click_updated_at`(`access_click_count`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `password_hash` TEXT NOT NULL,
    `my_invite_code` VARCHAR(32) NOT NULL,
    `parent_uid` CHAR(36) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `source_type` VARCHAR(50) NULL,
    `wechat_open_id` VARCHAR(64) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `last_login_at` DATETIME(0) NULL,
    `resume_pdf_export_count` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `users_phone_key`(`phone`),
    UNIQUE INDEX `users_my_invite_code_key`(`my_invite_code`),
    UNIQUE INDEX `users_wechat_open_id_key`(`wechat_open_id`),
    INDEX `idx_users_parent_uid`(`parent_uid`),
    INDEX `idx_users_status`(`status`),
    INDEX `idx_users_source_type`(`source_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phone_verification_codes` (
    `id` CHAR(36) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `business` VARCHAR(30) NOT NULL,
    `code_hash` VARCHAR(128) NOT NULL,
    `expires_at` DATETIME(0) NOT NULL,
    `last_sent_at` DATETIME(0) NOT NULL,
    `verified_at` DATETIME(0) NULL,
    `send_count` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_phone_verification_business_expires`(`business`, `expires_at`),
    UNIQUE INDEX `uniq_phone_verification_phone_business`(`phone`, `business`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_profiles` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NULL,
    `graduation_year` INTEGER NULL,
    `degree` VARCHAR(20) NULL,
    `school_name` VARCHAR(120) NULL,
    `major` VARCHAR(120) NULL,
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `user_profiles_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_job_preference_tags` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` CHAR(36) NOT NULL,
    `intention_city` JSON NOT NULL,
    `intention_job` JSON NOT NULL,
    `intention_company` JSON NOT NULL,
    `create_time` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_time` DATETIME(0) NOT NULL,

    UNIQUE INDEX `user_job_preference_tags_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_memberships` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `member_level` VARCHAR(30) NOT NULL DEFAULT 'standard',
    `start_at` DATETIME(0) NOT NULL,
    `end_at` DATETIME(0) NOT NULL,
    `standard_start_at` DATETIME(0) NULL,
    `standard_end_at` DATETIME(0) NULL,
    `super_start_at` DATETIME(0) NULL,
    `super_end_at` DATETIME(0) NULL,
    `remaining_days` INTEGER NOT NULL DEFAULT 0,
    `source_type` VARCHAR(30) NOT NULL DEFAULT 'manual',
    `source_remark` VARCHAR(255) NULL,
    `opened_by_admin_id` CHAR(36) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `user_memberships_user_id_key`(`user_id`),
    INDEX `idx_user_memberships_member_level`(`member_level`),
    INDEX `idx_user_memberships_standard_end_at`(`standard_end_at`),
    INDEX `idx_user_memberships_super_end_at`(`super_end_at`),
    INDEX `idx_user_memberships_source_type`(`source_type`),
    INDEX `idx_user_memberships_opened_by_admin`(`opened_by_admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resume_drafts` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `template_code` VARCHAR(40) NOT NULL DEFAULT 'classic',
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `content_json` JSON NULL,
    `style_json` JSON NULL,
    `layout_json` JSON NULL,
    `last_validated_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_resume_drafts_user_updated_at`(`user_id`, `updated_at`),
    INDEX `idx_resume_drafts_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resume_template_configs` (
    `id` CHAR(36) NOT NULL,
    `template_code` VARCHAR(40) NOT NULL,
    `template_name` VARCHAR(80) NOT NULL,
    `description` VARCHAR(255) NULL,
    `style_json` JSON NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `uk_resume_template_code`(`template_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_rich_text_contents` (
    `id` CHAR(36) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `html_content` LONGTEXT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'published',
    `version` INTEGER NOT NULL DEFAULT 1,
    `published_at` DATETIME(0) NULL,
    `published_by_admin_id` CHAR(36) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `membership_rich_text_contents_slug_key`(`slug`),
    INDEX `idx_membership_content_slug_status`(`slug`, `status`),
    INDEX `idx_membership_content_published_by_admin`(`published_by_admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_products` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `original_price` DECIMAL(10, 2) NOT NULL,
    `score` DECIMAL(3, 1) NOT NULL,
    `sales_count` INTEGER NOT NULL DEFAULT 0,
    `is_hot` BOOLEAN NOT NULL DEFAULT false,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `product_type` VARCHAR(20) NOT NULL DEFAULT 'service',
    `member_level` VARCHAR(30) NULL,
    `grant_days` INTEGER NULL,
    `detail_html` LONGTEXT NULL,
    `order_service_text` TEXT NULL,
    `order_service_image_url` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_service_products_type_status_hot`(`product_type`, `status`, `is_hot`, `sales_count`),
    INDEX `idx_service_products_type_member_level`(`product_type`, `member_level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_orders` (
    `id` CHAR(36) NOT NULL,
    `order_no` VARCHAR(40) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `order_type` VARCHAR(20) NOT NULL DEFAULT 'service',
    `title` VARCHAR(120) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `member_level` VARCHAR(30) NULL,
    `grant_days` INTEGER NULL,
    `pay_status` VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    `pay_channel` VARCHAR(30) NULL,
    `pay_scene` VARCHAR(20) NULL,
    `wechat_open_id` VARCHAR(64) NULL,
    `wechat_prepay_id` VARCHAR(100) NULL,
    `wechat_code_url` TEXT NULL,
    `wechat_h5_url` TEXT NULL,
    `wechat_transaction_id` VARCHAR(64) NULL,
    `callback_payload` JSON NULL,
    `pay_time` DATETIME(0) NULL,
    `expire_at` DATETIME(0) NULL,
    `closed_at` DATETIME(0) NULL,
    `refund_reason` VARCHAR(255) NULL,
    `refund_at` DATETIME(0) NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `service_orders_order_no_key`(`order_no`),
    INDEX `idx_orders_user_created`(`user_id`, `created_at`),
    INDEX `idx_orders_pay_status_created`(`pay_status`, `created_at`),
    INDEX `idx_orders_type_status_created`(`order_type`, `pay_status`, `created_at`),
    INDEX `idx_orders_expire_status`(`expire_at`, `pay_status`),
    INDEX `idx_orders_wechat_transaction`(`wechat_transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_job_tracking` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `job_id` CHAR(36) NOT NULL,
    `progress_status` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_tracking_progress`(`progress_status`),
    UNIQUE INDEX `uniq_user_job_tracking`(`user_id`, `job_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_redirect_link` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `random_key` VARCHAR(64) NOT NULL,
    `inviter_uid` CHAR(36) NOT NULL,
    `expire_at` DATETIME(0) NULL,
    `create_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `inv_redirect_link_random_key_key`(`random_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_visitor_trace` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `trace_sn` VARCHAR(64) NOT NULL,
    `inviter_uid` CHAR(36) NOT NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `click_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `expire_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `inv_visitor_trace_trace_sn_key`(`trace_sn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_wallet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` CHAR(36) NOT NULL,
    `available_balance` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `frozen_balance` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total_earn` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `update_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `user_wallet_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commission_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` CHAR(36) NOT NULL,
    `inviter_uid` CHAR(36) NOT NULL,
    `consume_uid` CHAR(36) NOT NULL,
    `commission_rate` INTEGER NOT NULL DEFAULT 15,
    `commission_money` DECIMAL(10, 2) NOT NULL,
    `original_consume_money` DECIMAL(10, 2) NOT NULL,
    `log_type` INTEGER NOT NULL,
    `create_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commission_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `one_level_rate` INTEGER NOT NULL DEFAULT 15,
    `update_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs_recommendation_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_weight` INTEGER NOT NULL DEFAULT 35,
    `job_weight` INTEGER NOT NULL DEFAULT 30,
    `city_exact_weight` INTEGER NOT NULL DEFAULT 20,
    `city_parent_weight` INTEGER NOT NULL DEFAULT 10,
    `degree_weight` INTEGER NOT NULL DEFAULT 8,
    `major_weight` INTEGER NOT NULL DEFAULT 8,
    `fresh_3_days_weight` INTEGER NOT NULL DEFAULT 6,
    `fresh_7_days_weight` INTEGER NOT NULL DEFAULT 3,
    `state_owned_fallback_weight` INTEGER NOT NULL DEFAULT 4,
    `delivered_penalty` INTEGER NOT NULL DEFAULT -12,
    `heat_max` INTEGER NOT NULL DEFAULT 6,
    `hot_access_threshold` INTEGER NOT NULL DEFAULT 50,
    `hot_delivery_threshold` INTEGER NOT NULL DEFAULT 10,
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `normalization_terms` (
    `id` CHAR(36) NOT NULL,
    `domain` VARCHAR(30) NOT NULL,
    `canonical_name` VARCHAR(120) NOT NULL,
    `canonical_code` VARCHAR(80) NULL,
    `level` VARCHAR(20) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `metadata` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_normalization_terms_domain_status`(`domain`, `status`),
    INDEX `idx_normalization_terms_domain_sort`(`domain`, `sort_order`),
    INDEX `idx_normalization_terms_domain_code`(`domain`, `canonical_code`),
    UNIQUE INDEX `uniq_normalization_terms_domain_name`(`domain`, `canonical_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `normalization_aliases` (
    `id` CHAR(36) NOT NULL,
    `term_id` CHAR(36) NOT NULL,
    `alias_name` VARCHAR(120) NOT NULL,
    `alias_normalized` VARCHAR(120) NOT NULL,
    `match_mode` VARCHAR(20) NOT NULL DEFAULT 'exact',
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `source` VARCHAR(30) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_normalization_alias_lookup_status`(`alias_normalized`, `status`),
    INDEX `idx_normalization_alias_term_status`(`term_id`, `status`),
    UNIQUE INDEX `uniq_normalization_alias_term_lookup`(`term_id`, `alias_normalized`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `location_hierarchies` (
    `id` CHAR(36) NOT NULL,
    `province_term_id` CHAR(36) NOT NULL,
    `city_term_id` CHAR(36) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `uniq_location_hierarchy_city_term`(`city_term_id`),
    INDEX `idx_location_hierarchy_province_status`(`province_term_id`, `status`),
    INDEX `idx_location_hierarchy_city_status`(`city_term_id`, `status`),
    UNIQUE INDEX `uniq_location_hierarchy_province_city`(`province_term_id`, `city_term_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_bind_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inviter_uid` CHAR(36) NOT NULL,
    `new_user_uid` CHAR(36) NOT NULL,
    `bind_time` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invite_reward_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inviter_uid` CHAR(36) NOT NULL,
    `milestone` INTEGER NOT NULL,
    `grant_days` INTEGER NOT NULL,
    `invite_count_snapshot` INTEGER NOT NULL,
    `triggered_by_user_id` CHAR(36) NULL,
    `rewarded_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_invite_reward_inviter_rewarded_at`(`inviter_uid`, `rewarded_at`),
    UNIQUE INDEX `uniq_invite_reward_inviter_milestone`(`inviter_uid`, `milestone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_users` (
    `id` CHAR(36) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `password_hash` TEXT NOT NULL,
    `real_name` VARCHAR(50) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `remark` TEXT NULL,
    `last_login_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `admin_users_username_key`(`username`),
    UNIQUE INDEX `admin_users_phone_key`(`phone`),
    UNIQUE INDEX `admin_users_email_key`(`email`),
    INDEX `idx_admin_users_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_roles` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `admin_roles_code_key`(`code`),
    UNIQUE INDEX `admin_roles_name_key`(`name`),
    INDEX `idx_admin_roles_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_user_roles` (
    `id` CHAR(36) NOT NULL,
    `admin_user_id` CHAR(36) NOT NULL,
    `role_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_admin_user_roles_role_id`(`role_id`),
    UNIQUE INDEX `uniq_admin_user_role`(`admin_user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_role_permissions` (
    `id` CHAR(36) NOT NULL,
    `role_id` CHAR(36) NOT NULL,
    `permission_key` VARCHAR(120) NOT NULL,
    `permission_name` VARCHAR(120) NOT NULL,
    `permission_group` VARCHAR(50) NULL,
    `permission_type` VARCHAR(20) NOT NULL DEFAULT 'api',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_admin_role_permission_group`(`permission_group`),
    UNIQUE INDEX `uniq_admin_role_permission`(`role_id`, `permission_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_bootstrap_configs` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `register_entry_closed` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_operation_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `admin_user_id` CHAR(36) NULL,
    `module` VARCHAR(50) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `target_type` VARCHAR(50) NULL,
    `target_id` VARCHAR(64) NULL,
    `request_method` VARCHAR(10) NULL,
    `request_path` VARCHAR(191) NULL,
    `request_payload` JSON NULL,
    `response_summary` VARCHAR(255) NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_admin_operation_module_created`(`module`, `created_at`),
    INDEX `idx_admin_operation_user_created`(`admin_user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_redeem_code_batches` (
    `id` CHAR(36) NOT NULL,
    `batch_no` VARCHAR(32) NOT NULL,
    `member_level` VARCHAR(30) NOT NULL DEFAULT 'standard',
    `card_type` VARCHAR(20) NOT NULL,
    `grant_days` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `used_count` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `valid_from` DATETIME(0) NULL,
    `valid_until` DATETIME(0) NULL,
    `remark` VARCHAR(255) NULL,
    `created_by_admin_id` CHAR(36) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `membership_redeem_code_batches_batch_no_key`(`batch_no`),
    INDEX `idx_redeem_batches_member_level`(`member_level`),
    INDEX `idx_redeem_batches_status_valid_until`(`status`, `valid_until`),
    INDEX `idx_redeem_batches_created_by_admin`(`created_by_admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_redeem_codes` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `batch_id` CHAR(36) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'unused',
    `valid_until` DATETIME(0) NULL,
    `used_by_user_id` CHAR(36) NULL,
    `used_at` DATETIME(0) NULL,
    `invalidated_by_admin_id` CHAR(36) NULL,
    `invalidated_at` DATETIME(0) NULL,
    `invalid_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `membership_redeem_codes_code_key`(`code`),
    INDEX `idx_redeem_codes_batch_status`(`batch_id`, `status`),
    INDEX `idx_redeem_codes_used_by_user`(`used_by_user_id`),
    INDEX `idx_redeem_codes_invalidated_by_admin`(`invalidated_by_admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_redeem_use_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` CHAR(36) NOT NULL,
    `code_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `membership_id` CHAR(36) NULL,
    `grant_days` INTEGER NOT NULL,
    `used_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `remark` VARCHAR(255) NULL,

    INDEX `idx_redeem_use_logs_user_used_at`(`user_id`, `used_at`),
    INDEX `idx_redeem_use_logs_batch_used_at`(`batch_id`, `used_at`),
    INDEX `idx_redeem_use_logs_membership_id`(`membership_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_roles` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `is_system` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `member_roles_code_key`(`code`),
    UNIQUE INDEX `member_roles_name_key`(`name`),
    INDEX `idx_member_roles_status`(`status`),
    INDEX `idx_member_roles_sort_order`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_role_permissions` (
    `id` CHAR(36) NOT NULL,
    `role_id` CHAR(36) NOT NULL,
    `permission_key` VARCHAR(120) NOT NULL,
    `permission_name` VARCHAR(120) NOT NULL,
    `permission_group` VARCHAR(50) NULL,
    `permission_type` VARCHAR(20) NOT NULL DEFAULT 'member',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_member_role_permission_group`(`permission_group`),
    UNIQUE INDEX `uniq_member_role_permission`(`role_id`, `permission_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_parent_uid_fkey` FOREIGN KEY (`parent_uid`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_job_preference_tags` ADD CONSTRAINT `user_job_preference_tags_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_memberships` ADD CONSTRAINT `user_memberships_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resume_drafts` ADD CONSTRAINT `resume_drafts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `service_products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_job_tracking` ADD CONSTRAINT `user_job_tracking_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_job_tracking` ADD CONSTRAINT `user_job_tracking_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `job_announcements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_redirect_link` ADD CONSTRAINT `inv_redirect_link_inviter_uid_fkey` FOREIGN KEY (`inviter_uid`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_visitor_trace` ADD CONSTRAINT `inv_visitor_trace_inviter_uid_fkey` FOREIGN KEY (`inviter_uid`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_wallet` ADD CONSTRAINT `user_wallet_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commission_log` ADD CONSTRAINT `commission_log_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `service_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commission_log` ADD CONSTRAINT `commission_log_inviter_uid_fkey` FOREIGN KEY (`inviter_uid`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commission_log` ADD CONSTRAINT `commission_log_consume_uid_fkey` FOREIGN KEY (`consume_uid`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `normalization_aliases` ADD CONSTRAINT `normalization_aliases_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `normalization_terms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `location_hierarchies` ADD CONSTRAINT `location_hierarchies_province_term_id_fkey` FOREIGN KEY (`province_term_id`) REFERENCES `normalization_terms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `location_hierarchies` ADD CONSTRAINT `location_hierarchies_city_term_id_fkey` FOREIGN KEY (`city_term_id`) REFERENCES `normalization_terms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_bind_log` ADD CONSTRAINT `inv_bind_log_inviter_uid_fkey` FOREIGN KEY (`inviter_uid`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_bind_log` ADD CONSTRAINT `inv_bind_log_new_user_uid_fkey` FOREIGN KEY (`new_user_uid`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invite_reward_log` ADD CONSTRAINT `invite_reward_log_inviter_uid_fkey` FOREIGN KEY (`inviter_uid`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_user_roles` ADD CONSTRAINT `admin_user_roles_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_user_roles` ADD CONSTRAINT `admin_user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_role_permissions` ADD CONSTRAINT `admin_role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_operation_logs` ADD CONSTRAINT `admin_operation_logs_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_redeem_code_batches` ADD CONSTRAINT `membership_redeem_code_batches_created_by_admin_id_fkey` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_redeem_codes` ADD CONSTRAINT `membership_redeem_codes_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `membership_redeem_code_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_redeem_codes` ADD CONSTRAINT `membership_redeem_codes_invalidated_by_admin_id_fkey` FOREIGN KEY (`invalidated_by_admin_id`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_redeem_use_logs` ADD CONSTRAINT `membership_redeem_use_logs_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `membership_redeem_code_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_redeem_use_logs` ADD CONSTRAINT `membership_redeem_use_logs_code_id_fkey` FOREIGN KEY (`code_id`) REFERENCES `membership_redeem_codes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_role_permissions` ADD CONSTRAINT `member_role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `member_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

