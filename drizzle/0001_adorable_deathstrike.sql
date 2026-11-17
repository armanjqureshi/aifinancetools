CREATE TABLE `cron_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_uid` varchar(65),
	`is_enabled` int NOT NULL DEFAULT 1,
	`cron_expression` varchar(64) NOT NULL DEFAULT '0 0 6 1 * *',
	`last_run_at` timestamp,
	`next_run_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cron_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fund_allocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fund_run_result_id` int NOT NULL,
	`fund_id` int NOT NULL,
	`run_job_id` int NOT NULL,
	`allocation_type` enum('sector','asset') NOT NULL,
	`label` varchar(128) NOT NULL,
	`percentage` decimal(6,2),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fund_allocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fund_run_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_job_id` int NOT NULL,
	`fund_id` int NOT NULL,
	`status` enum('pending','downloading','parsing','completed','failed') NOT NULL DEFAULT 'pending',
	`pdf_file_key` varchar(512),
	`pdf_file_url` text,
	`error_message` text,
	`extracted_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fund_run_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mutual_funds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`fund_house` varchar(64) NOT NULL,
	`isin` varchar(20),
	`factsheet_url` text,
	`is_active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mutual_funds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `run_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggered_by` enum('manual','cron') NOT NULL DEFAULT 'manual',
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`total_funds` int DEFAULT 0,
	`success_count` int DEFAULT 0,
	`failed_count` int DEFAULT 0,
	`excel_file_key` varchar(512),
	`excel_file_url` text,
	`error_message` text,
	`schedule_cron_task_uid` varchar(65),
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `run_jobs_id` PRIMARY KEY(`id`)
);
