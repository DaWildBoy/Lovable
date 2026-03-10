/*
  # Make pod-photos storage bucket public

  1. Changes
    - Updates `pod-photos` bucket from private to public
    - This allows POD photos and signatures to be viewable by
      customers and couriers without needing signed URLs
    - The getPublicUrl() calls throughout the app will now work correctly

  2. Why
    - POD photos were being stored but images appeared broken
      because the bucket was private and getPublicUrl() returns
      inaccessible URLs for private buckets
    - Both customers and couriers need to view delivery proof images
*/

UPDATE storage.buckets
SET public = true
WHERE id = 'pod-photos';
