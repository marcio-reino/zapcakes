-- AlterTable: Add user_id to categories with default for existing rows
ALTER TABLE `categories` ADD COLUMN `user_id` INT NOT NULL DEFAULT 1;

-- AlterTable: Add user_id to products with default for existing rows
ALTER TABLE `products` ADD COLUMN `user_id` INT NOT NULL DEFAULT 1;

-- Remove defaults (only needed for existing data migration)
ALTER TABLE `categories` ALTER COLUMN `user_id` DROP DEFAULT;
ALTER TABLE `products` ALTER COLUMN `user_id` DROP DEFAULT;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `categories_user_id_idx` ON `categories`(`user_id`);

-- CreateIndex
CREATE INDEX `products_user_id_idx` ON `products`(`user_id`);
