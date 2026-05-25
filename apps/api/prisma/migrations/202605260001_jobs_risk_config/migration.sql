ALTER TABLE `admin_bootstrap_configs`
  ADD COLUMN `jobs_risk_config` JSON NULL AFTER `register_entry_closed`;
