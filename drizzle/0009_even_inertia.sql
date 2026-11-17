CREATE TABLE `amfi_classification_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`effective_from` timestamp NOT NULL,
	`effective_to` timestamp,
	`source_url` varchar(1024) NOT NULL,
	`source_label` varchar(256) NOT NULL,
	`source_checksum` varchar(128),
	`imported_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `amfi_classification_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `amfi_classification_snapshot_effective_unique` UNIQUE(`effective_from`)
);
--> statement-breakpoint
CREATE TABLE `amfi_security_classifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshot_id` int NOT NULL,
	`rank` int NOT NULL,
	`company_name` varchar(512) NOT NULL,
	`normalized_name` varchar(512) NOT NULL,
	`isin` varchar(20),
	`nse_symbol` varchar(64),
	`bse_symbol` varchar(64),
	`category` enum('large_cap','mid_cap','small_cap') NOT NULL,
	`average_market_cap_cr` decimal(18,4),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `amfi_security_classifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `amfi_security_snapshot_isin_unique` UNIQUE(`snapshot_id`,`isin`)
);
--> statement-breakpoint
CREATE TABLE `calculated_market_cap_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`normalized_scheme_name` varchar(256) NOT NULL,
	`snapshot_id` int NOT NULL,
	`allocations_json` mediumtext NOT NULL,
	`mapped_holdings_json` mediumtext NOT NULL,
	`unresolved_holdings_json` mediumtext NOT NULL,
	`coverage_percent` decimal(6,2) NOT NULL,
	`calculation_status` enum('verified','partial','insufficient_portfolio_data') NOT NULL,
	`reviewer_note` text,
	`reviewed_by` int,
	`reviewed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calculated_market_cap_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `calculated_market_cap_document_scheme_snapshot_unique` UNIQUE(`document_id`,`normalized_scheme_name`,`snapshot_id`)
);
--> statement-breakpoint
CREATE INDEX `amfi_security_snapshot_name_idx` ON `amfi_security_classifications` (`snapshot_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `calculated_market_cap_snapshot_idx` ON `calculated_market_cap_evidence` (`snapshot_id`);