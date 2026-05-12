-- 2026-05-12
-- 本脚本仅包含本次会员/邀请奖励相关的表结构变更。
-- 请在线上正式 MySQL 中手动执行；不要导入任何本地测试数据。

ALTER TABLE `user_memberships`
  ADD COLUMN `standard_end_at` DATETIME(0) NULL,
  ADD COLUMN `standard_start_at` DATETIME(0) NULL,
  ADD COLUMN `super_end_at` DATETIME(0) NULL,
  ADD COLUMN `super_start_at` DATETIME(0) NULL;

CREATE TABLE `invite_reward_log` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `inviter_uid` CHAR(36) NOT NULL,
  `milestone` INTEGER NOT NULL,
  `grant_days` INTEGER NOT NULL,
  `invite_count_snapshot` INTEGER NOT NULL,
  `triggered_by_user_id` CHAR(36) NULL,
  `rewarded_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_invite_reward_inviter_rewarded_at` (`inviter_uid`, `rewarded_at`),
  UNIQUE INDEX `uniq_invite_reward_inviter_milestone` (`inviter_uid`, `milestone`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_user_memberships_standard_end_at` ON `user_memberships` (`standard_end_at`);
CREATE INDEX `idx_user_memberships_super_end_at` ON `user_memberships` (`super_end_at`);

ALTER TABLE `invite_reward_log`
  ADD CONSTRAINT `invite_reward_log_inviter_uid_fkey`
  FOREIGN KEY (`inviter_uid`) REFERENCES `users`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
