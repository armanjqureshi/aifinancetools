CREATE TABLE `chat_contexts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`fund_ids` text NOT NULL,
	`question` text NOT NULL,
	`answer` mediumtext NOT NULL,
	`source_snapshot` mediumtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_contexts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `chat_contexts_user_id_idx` ON `chat_contexts` (`user_id`);