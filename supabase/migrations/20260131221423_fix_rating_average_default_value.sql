/*
  # Fix Rating Average Default Value

  1. Changes
    - Set default value of 0 for rating_average column in profiles table
    - Backfill NULL values to 0 for existing profiles
  
  2. Notes
    - This ensures new providers display "0.00 (0)" instead of "New provider" when they have 0 ratings
    - Keeps the display consistent across the app
*/

-- Set default for rating_average
ALTER TABLE profiles 
ALTER COLUMN rating_average SET DEFAULT 0;

-- Backfill NULL values to 0
UPDATE profiles 
SET rating_average = 0 
WHERE rating_average IS NULL;