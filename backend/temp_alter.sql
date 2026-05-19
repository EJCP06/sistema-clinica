ALTER TABLE "Atencion" ADD COLUMN IF NOT EXISTS id_consultorio INTEGER REFERENCES "Consultorios"("id_consultorio");
