-- Preserve the original path when migrating legacy files into protected storage.
ALTER TABLE tastenet.media_files ADD COLUMN IF NOT EXISTS source_path text;
