CREATE TABLE `amc_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`amc_id` int NOT NULL,
	`source_url` varchar(1024) NOT NULL,
	`source_kind` enum('page','direct_pdf') NOT NULL DEFAULT 'page',
	`document_scope` enum('unknown','amc','scheme','both') NOT NULL DEFAULT 'unknown',
	`discovery_mode` enum('html','dynamic','selector','direct','manual') NOT NULL DEFAULT 'html',
	`notes` text,
	`priority` int NOT NULL DEFAULT 1,
	`is_active` int NOT NULL DEFAULT 1,
	`last_checked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `amc_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `amc_sources_url_unique` UNIQUE(`source_url`)
);
--> statement-breakpoint
CREATE TABLE `amcs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`slug` varchar(96) NOT NULL,
	`is_active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `amcs_id` PRIMARY KEY(`id`),
	CONSTRAINT `amcs_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `factsheet_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`amc_id` int NOT NULL,
	`source_id` int,
	`scheme_id` int,
	`document_scope` enum('amc','scheme') NOT NULL DEFAULT 'amc',
	`source_url` varchar(1024) NOT NULL,
	`resolved_pdf_url` varchar(1024),
	`as_of_label` varchar(64),
	`file_key` varchar(512),
	`file_url` text,
	`extracted_text` mediumtext,
	`status` enum('discovered','downloading','parsed','failed') NOT NULL DEFAULT 'discovered',
	`error_message` text,
	`downloaded_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `factsheet_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheme_catalog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`amc_id` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`normalized_name` varchar(256) NOT NULL,
	`scheme_code` varchar(64),
	`isin` varchar(20),
	`factsheet_url` text,
	`source_type` enum('discovered','manual','fund_list') NOT NULL DEFAULT 'discovered',
	`is_active` int NOT NULL DEFAULT 1,
	`last_seen_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheme_catalog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `fund_allocations` MODIFY COLUMN `allocation_type` enum('sector','asset','market_cap') NOT NULL;--> statement-breakpoint
ALTER TABLE `fund_allocations` ADD `factsheet_document_id` int;--> statement-breakpoint
ALTER TABLE `fund_run_results` ADD `factsheet_document_id` int;--> statement-breakpoint
ALTER TABLE `mutual_funds` ADD `amc_id` int;--> statement-breakpoint
ALTER TABLE `mutual_funds` ADD `scheme_catalog_id` int;--> statement-breakpoint
CREATE INDEX `amc_sources_amc_id_idx` ON `amc_sources` (`amc_id`);--> statement-breakpoint
CREATE INDEX `factsheet_documents_amc_id_idx` ON `factsheet_documents` (`amc_id`);--> statement-breakpoint
CREATE INDEX `factsheet_documents_scheme_id_idx` ON `factsheet_documents` (`scheme_id`);--> statement-breakpoint
CREATE INDEX `factsheet_documents_source_id_idx` ON `factsheet_documents` (`source_id`);--> statement-breakpoint
CREATE INDEX `scheme_catalog_amc_id_idx` ON `scheme_catalog` (`amc_id`);--> statement-breakpoint
CREATE INDEX `scheme_catalog_normalized_name_idx` ON `scheme_catalog` (`normalized_name`);