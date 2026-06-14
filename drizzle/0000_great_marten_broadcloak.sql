CREATE TABLE `change_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source_version_id` text NOT NULL,
	`change_type` text NOT NULL,
	`summary` text NOT NULL,
	`detail` text NOT NULL,
	`severity` real DEFAULT 0.5 NOT NULL,
	`affected_topics` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`source_version_id`) REFERENCES `source_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'fresh' NOT NULL,
	`current_version_id` text,
	`confidence` real DEFAULT 1 NOT NULL,
	`last_healed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_topics` (
	`content_item_id` text NOT NULL,
	`topic_id` text NOT NULL,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`content_item_id` text NOT NULL,
	`version` integer NOT NULL,
	`body_json` text NOT NULL,
	`embedding` text,
	`source_version_ids` text DEFAULT '[]' NOT NULL,
	`kg_snapshot` text DEFAULT '{}' NOT NULL,
	`agent_context` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'live' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `review_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`content_item_id` text NOT NULL,
	`change_event_id` text,
	`workflow_run_id` text,
	`proposed_version_id` text,
	`status` text DEFAULT 'needs_human' NOT NULL,
	`eval_scores` text DEFAULT '{}' NOT NULL,
	`impact` text DEFAULT '{}' NOT NULL,
	`reasoning` text DEFAULT '' NOT NULL,
	`human_feedback` text,
	`confidence` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`change_event_id`) REFERENCES `change_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposed_version_id`) REFERENCES `content_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `run_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_run_id` text NOT NULL,
	`agent` text NOT NULL,
	`step` text NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`input_json` text DEFAULT '{}' NOT NULL,
	`output_json` text DEFAULT '{}' NOT NULL,
	`reasoning` text DEFAULT '' NOT NULL,
	`seq` integer NOT NULL,
	`duration_ms` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `source_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`embedding` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`embedding` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`input_json` text DEFAULT '{}' NOT NULL,
	`summary_json` text DEFAULT '{}' NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`finished_at` text
);
