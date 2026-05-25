ALTER TABLE `ai_model_configs`
ADD COLUMN `assessment_prompt_template` LONGTEXT NULL
AFTER `professional_prompt_template`;
