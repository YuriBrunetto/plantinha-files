/*
  Warnings:

  - Added the required column `updatedAt` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "File" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
