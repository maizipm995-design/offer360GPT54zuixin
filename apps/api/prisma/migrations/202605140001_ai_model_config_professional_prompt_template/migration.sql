ALTER TABLE `ai_model_configs`
ADD COLUMN `professional_prompt_template` LONGTEXT NULL
AFTER `entry_prompt_template`;
