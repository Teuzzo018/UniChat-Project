-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_universityId_fkey";

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
