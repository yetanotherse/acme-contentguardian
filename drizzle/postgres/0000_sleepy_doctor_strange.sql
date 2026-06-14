CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "change_events" (
	"id" text PRIMARY KEY NOT NULL,
	"source_version_id" text NOT NULL,
	"change_type" text NOT NULL,
	"summary" text NOT NULL,
	"detail" text NOT NULL,
	"severity" double precision DEFAULT 0.5 NOT NULL,
	"affected_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'fresh' NOT NULL,
	"current_version_id" text,
	"confidence" double precision DEFAULT 1 NOT NULL,
	"last_healed_at" text,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_topics" (
	"content_item_id" text NOT NULL,
	"topic_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"content_item_id" text NOT NULL,
	"version" integer NOT NULL,
	"body_json" jsonb NOT NULL,
	"embedding" vector(1536),
	"source_version_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kg_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"agent_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'live' NOT NULL,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"content_item_id" text NOT NULL,
	"change_event_id" text,
	"workflow_run_id" text,
	"proposed_version_id" text,
	"base_version_id" text,
	"status" text DEFAULT 'needs_human' NOT NULL,
	"eval_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"impact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reasoning" text DEFAULT '' NOT NULL,
	"review_reason" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"human_feedback" text,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"resolved_at" text
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_run_id" text NOT NULL,
	"agent" text NOT NULL,
	"step" text NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"input_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reasoning" text DEFAULT '' NOT NULL,
	"seq" integer NOT NULL,
	"duration_ms" integer,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"embedding" vector(1536),
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"embedding" vector(1536),
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"input_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" text DEFAULT to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"finished_at" text
);
--> statement-breakpoint
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_source_version_id_source_versions_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."source_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_topics" ADD CONSTRAINT "content_topics_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_topics" ADD CONSTRAINT "content_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_change_event_id_change_events_id_fk" FOREIGN KEY ("change_event_id") REFERENCES "public"."change_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_proposed_version_id_content_versions_id_fk" FOREIGN KEY ("proposed_version_id") REFERENCES "public"."content_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_base_version_id_content_versions_id_fk" FOREIGN KEY ("base_version_id") REFERENCES "public"."content_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_versions" ADD CONSTRAINT "source_versions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;