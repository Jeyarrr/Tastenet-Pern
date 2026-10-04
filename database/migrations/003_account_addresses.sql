-- Keep imported free-form addresses; structured details are saved on registration/edit.
ALTER TABLE tastenet.users ADD COLUMN IF NOT EXISTS address_details jsonb;
