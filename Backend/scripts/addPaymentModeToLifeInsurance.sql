-- Migration script to add payment_mode column to LifePolicies and PreviousLifePolicies tables

-- Add payment_mode to LifePolicies table
ALTER TABLE `LifePolicies` 
ADD COLUMN `payment_mode` ENUM('Monthly', 'Quarterly', 'Half-Yearly', 'Yearly') 
NOT NULL DEFAULT 'Yearly' 
COMMENT 'Premium payment frequency'
AFTER `ppt`;

-- Add payment_mode to PreviousLifePolicies table
ALTER TABLE `PreviousLifePolicies` 
ADD COLUMN `payment_mode` ENUM('Monthly', 'Quarterly', 'Half-Yearly', 'Yearly') 
NULL DEFAULT 'Yearly' 
COMMENT 'Premium payment frequency'
AFTER `ppt`;

-- Verify the changes
DESCRIBE `LifePolicies`;
DESCRIBE `PreviousLifePolicies`;
