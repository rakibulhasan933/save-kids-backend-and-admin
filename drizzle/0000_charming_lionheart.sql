CREATE TYPE "public"."child_status" AS ENUM('unpaired', 'paired', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."live_screen_status" AS ENUM('requested', 'active', 'ended', 'failed');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('android', 'ios', 'web');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "app_block_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"package_name" varchar(255) NOT NULL,
	"label" varchar(120),
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"device_uuid" varchar(255) NOT NULL,
	"platform" "device_platform" NOT NULL,
	"os_version" varchar(80) NOT NULL,
	"app_version" varchar(80) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_online_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "child_devices_device_uuid_unique" UNIQUE("device_uuid")
);
--> statement-breakpoint
CREATE TABLE "children" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"pairing_code" varchar(10) NOT NULL,
	"status" "child_status" DEFAULT 'unpaired' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "children_pairing_code_unique" UNIQUE("pairing_code")
);
--> statement-breakpoint
CREATE TABLE "live_screen_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"admin_id" uuid NOT NULL,
	"status" "live_screen_status" DEFAULT 'requested' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_filter_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"domain" varchar(255) NOT NULL,
	"category" varchar(80),
	"is_blocked" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_block_rules" ADD CONSTRAINT "app_block_rules_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_devices" ADD CONSTRAINT "child_devices_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_screen_sessions" ADD CONSTRAINT "live_screen_sessions_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_screen_sessions" ADD CONSTRAINT "live_screen_sessions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_filter_rules" ADD CONSTRAINT "web_filter_rules_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_block_rules_child_id_idx" ON "app_block_rules" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "child_devices_child_id_idx" ON "child_devices" USING btree ("child_id");--> statement-breakpoint
CREATE UNIQUE INDEX "child_devices_device_uuid_idx" ON "child_devices" USING btree ("device_uuid");--> statement-breakpoint
CREATE INDEX "children_admin_id_idx" ON "children" USING btree ("admin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "children_pairing_code_idx" ON "children" USING btree ("pairing_code");--> statement-breakpoint
CREATE INDEX "live_screen_sessions_child_id_idx" ON "live_screen_sessions" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "live_screen_sessions_admin_id_idx" ON "live_screen_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "web_filter_rules_child_id_idx" ON "web_filter_rules" USING btree ("child_id");