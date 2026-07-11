-- CreateIndex
CREATE INDEX "Event_camera_id_idx" ON "Event"("camera_id");

-- CreateIndex
CREATE INDEX "Event_person_id_idx" ON "Event"("person_id");

-- CreateIndex
CREATE INDEX "Event_created_at_idx" ON "Event"("created_at");
