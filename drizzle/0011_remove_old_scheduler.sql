DROP TABLE `cron_config`;--> statement-breakpoint
ALTER TABLE `amc_download_retries` DROP INDEX `amc_download_retries_task_unique`;--> statement-breakpoint
ALTER TABLE `amc_download_retries` DROP COLUMN `schedule_cron_task_uid`;--> statement-breakpoint
ALTER TABLE `run_jobs` DROP COLUMN `schedule_cron_task_uid`;