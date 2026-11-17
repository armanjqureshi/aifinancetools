CREATE TABLE `amc_download_retries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`amc_id` int NOT NULL,
	`source_id` int NOT NULL,
	`status` enum('timed_out','unavailable') NOT NULL,
	`attempt_count` int NOT NULL DEFAULT 0,
	`next_retry_at` timestamp NOT NULL,
	`last_attempt_at` timestamp,
	`last_success_at` timestamp,
	`last_error` text,
	`is_enabled` int NOT NULL DEFAULT 1,
	`schedule_cron_task_uid` varchar(65),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `amc_download_retries_id` PRIMARY KEY(`id`),
	CONSTRAINT `amc_download_retries_amc_unique` UNIQUE(`amc_id`),
	CONSTRAINT `amc_download_retries_task_unique` UNIQUE(`schedule_cron_task_uid`)
);
--> statement-breakpoint
CREATE INDEX `amc_download_retries_due_idx` ON `amc_download_retries` (`is_enabled`,`next_retry_at`);