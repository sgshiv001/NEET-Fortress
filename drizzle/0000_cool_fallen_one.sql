CREATE TABLE `center_telemetry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`region` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`temperature` real,
	`wind_speed` real,
	`risk_score` integer NOT NULL,
	`status` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `intelligence_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
