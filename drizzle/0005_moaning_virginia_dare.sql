CREATE TABLE `visual_allocation_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`normalized_scheme_name` varchar(256) NOT NULL,
	`allocation_type` enum('market_cap') NOT NULL,
	`allocations_json` mediumtext NOT NULL,
	`evidence` text NOT NULL,
	`source_page` int,
	`confidence` decimal(5,2) NOT NULL,
	`extraction_model` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visual_allocation_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `visual_allocation_evidence_document_scheme_type_uq` UNIQUE(`document_id`,`normalized_scheme_name`,`allocation_type`)
);
--> statement-breakpoint
CREATE INDEX `visual_allocation_evidence_document_idx` ON `visual_allocation_evidence` (`document_id`);