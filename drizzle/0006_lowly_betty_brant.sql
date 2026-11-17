ALTER TABLE `visual_allocation_evidence` ADD `review_status` enum('unreviewed','verified','corrected','rejected') DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE `visual_allocation_evidence` ADD `reviewer_note` text;--> statement-breakpoint
ALTER TABLE `visual_allocation_evidence` ADD `reviewed_by` int;--> statement-breakpoint
ALTER TABLE `visual_allocation_evidence` ADD `reviewed_at` timestamp;