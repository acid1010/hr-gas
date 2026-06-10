-- Fix attendance timestamps: previously stored as WIB values in UTC column (7h ahead).
-- Subtract 7 hours to convert to correct UTC.
UPDATE attendance SET punch_time = punch_time - INTERVAL '7 hours';
