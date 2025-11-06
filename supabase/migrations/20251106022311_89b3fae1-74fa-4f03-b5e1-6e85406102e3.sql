-- Add UPDATE policy for vehicle_photos table
CREATE POLICY "Users can update their vehicle photos"
ON vehicle_photos
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM vehicles
    WHERE vehicles.id = vehicle_photos.vehicle_id
    AND vehicles.driver_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM vehicles
    WHERE vehicles.id = vehicle_photos.vehicle_id
    AND vehicles.driver_id = auth.uid()
  )
);