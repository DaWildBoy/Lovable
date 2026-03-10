/*
  # Make delivery-proofs storage bucket public

  1. Changes
    - Updates `delivery-proofs` bucket from private to public
    - Allows cargo item delivery proof photos and signatures to be
      viewed by customers and couriers without signed URLs

  2. Why
    - Delivery proof images were appearing broken because the bucket
      was private and getPublicUrl() only works with public buckets
    - Both customers and couriers need to view these proof images
*/

UPDATE storage.buckets
SET public = true
WHERE id = 'delivery-proofs';
