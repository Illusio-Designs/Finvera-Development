-- ========================================
-- COMPLETE RENEWAL SYSTEM UPDATE SCRIPT
-- ========================================
-- This script updates:
-- 1. Adds payment_mode to Life Insurance tables
-- 2. Updates all renewal configurations with correct intervals
-- 3. Ensures data consistency
-- ========================================

-- ========================================
-- PART 1: ADD PAYMENT_MODE TO LIFE INSURANCE
-- ========================================

-- Check if payment_mode column exists in LifePolicies
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'LifePolicies'
    AND COLUMN_NAME = 'payment_mode'
);

-- Add payment_mode to LifePolicies if it doesn't exist
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `LifePolicies` 
     ADD COLUMN `payment_mode` ENUM(''Monthly'', ''Quarterly'', ''Half-Yearly'', ''Yearly'') 
     NOT NULL DEFAULT ''Yearly'' 
     COMMENT ''Premium payment frequency''
     AFTER `ppt`',
    'SELECT ''Column payment_mode already exists in LifePolicies'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if payment_mode column exists in PreviousLifePolicies
SET @column_exists_prev = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'PreviousLifePolicies'
    AND COLUMN_NAME = 'payment_mode'
);

-- Add payment_mode to PreviousLifePolicies if it doesn't exist
SET @sql_prev = IF(@column_exists_prev = 0,
    'ALTER TABLE `PreviousLifePolicies` 
     ADD COLUMN `payment_mode` ENUM(''Monthly'', ''Quarterly'', ''Half-Yearly'', ''Yearly'') 
     NULL DEFAULT ''Yearly'' 
     COMMENT ''Premium payment frequency''
     AFTER `ppt`',
    'SELECT ''Column payment_mode already exists in PreviousLifePolicies'' AS message'
);

PREPARE stmt_prev FROM @sql_prev;
EXECUTE stmt_prev;
DEALLOCATE PREPARE stmt_prev;

-- Update existing Life Insurance policies with default payment_mode
UPDATE `LifePolicies` 
SET `payment_mode` = 'Yearly' 
WHERE `payment_mode` IS NULL;

UPDATE `PreviousLifePolicies` 
SET `payment_mode` = 'Yearly' 
WHERE `payment_mode` IS NULL;

SELECT 'Payment mode columns added/verified successfully' AS status;

-- ========================================
-- PART 2: UPDATE RENEWAL CONFIGURATIONS
-- ========================================

-- Update Vehicle Insurance
UPDATE `RenewalConfigs`
SET 
    `reminderTimes` = 3,
    `reminderDays` = 30,
    `reminderIntervals` = JSON_ARRAY(30, 15, 7)
WHERE `serviceType` = 'vehicle';

-- Update Employee Compensation Policy
UPDATE `RenewalConfigs`
SET 
    `reminderTimes` = 3,
    `reminderDays` = 30,
    `reminderIntervals` = JSON_ARRAY(30, 15, 7)
WHERE `serviceType` = 'ecp';

-- Update Health Insurance
UPDATE `RenewalConfigs`
SET 
    `reminderTimes` = 3,
    `reminderDays` = 30,
    `reminderIntervals` = JSON_ARRAY(30, 15, 7)
WHERE `serviceType` = 'health';

-- Update Fire Insurance
UPDATE `RenewalConfigs`
SET 
    `reminderTimes` = 3,
    `reminderDays` = 30,
    `reminderIntervals` = JSON_ARRAY(30, 15, 7)
WHERE `serviceType` = 'fire';

-- Update Digital Signature Certificate
UPDATE `RenewalConfigs`
SET 
    `reminderTimes` = 3,
    `reminderDays` = 30,
    `reminderIntervals` = JSON_ARRAY(30, 15, 7)
WHERE `serviceType` = 'dsc';

-- Update Factory License
UPDATE `RenewalConfigs`
SET 
    `reminderTimes` = 3,
    `reminderDays` = 30,
    `reminderIntervals` = JSON_ARRAY(30, 15, 7)
WHERE `serviceType` = 'factory';

-- Update Labour License
UPDATE `RenewalConfigs`
SET 
    `reminderTimes` = 3,
    `reminderDays` = 30,
    `reminderIntervals` = JSON_ARRAY(30, 15, 7)
WHERE `serviceType` = 'labour_license';

-- Update Labour Inspection (special case - 15 days, 5 reminders)
UPDATE `RenewalConfigs`
SET 
    `reminderTimes` = 5,
    `reminderDays` = 15,
    `reminderIntervals` = JSON_ARRAY(15, 10, 7, 3, 1)
WHERE `serviceType` = 'labour_inspection';

-- Update Stability Management
UPDATE `RenewalConfigs`
SET 
    `reminderTimes` = 3,
    `reminderDays` = 30,
    `reminderIntervals` = JSON_ARRAY(30, 15, 7)
WHERE `serviceType` = 'stability';

-- Update Life Insurance (PPT-based reminders)
UPDATE `RenewalConfigs`
SET 
    `reminderTimes` = 3,
    `reminderDays` = 30,
    `reminderIntervals` = JSON_ARRAY(30, 15, 7)
WHERE `serviceType` = 'life';

SELECT 'Renewal configurations updated successfully' AS status;

-- ========================================
-- PART 3: VERIFICATION QUERIES
-- ========================================

-- Verify Life Insurance tables structure
SELECT 
    'LifePolicies Structure' AS table_name,
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'LifePolicies'
AND COLUMN_NAME IN ('ppt', 'payment_mode')
ORDER BY ORDINAL_POSITION;

SELECT 
    'PreviousLifePolicies Structure' AS table_name,
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'PreviousLifePolicies'
AND COLUMN_NAME IN ('ppt', 'payment_mode')
ORDER BY ORDINAL_POSITION;

-- Verify Renewal Configurations
SELECT 
    serviceType,
    serviceName,
    reminderTimes,
    reminderDays,
    reminderIntervals,
    isActive
FROM `RenewalConfigs`
ORDER BY 
    CASE serviceType
        WHEN 'vehicle' THEN 1
        WHEN 'ecp' THEN 2
        WHEN 'health' THEN 3
        WHEN 'fire' THEN 4
        WHEN 'dsc' THEN 5
        WHEN 'factory' THEN 6
        WHEN 'labour_license' THEN 7
        WHEN 'labour_inspection' THEN 8
        WHEN 'stability' THEN 9
        WHEN 'life' THEN 10
        ELSE 11
    END;

-- Count Life Insurance policies by payment mode
SELECT 
    payment_mode,
    COUNT(*) as policy_count
FROM `LifePolicies`
GROUP BY payment_mode
ORDER BY 
    CASE payment_mode
        WHEN 'Monthly' THEN 1
        WHEN 'Quarterly' THEN 2
        WHEN 'Half-Yearly' THEN 3
        WHEN 'Yearly' THEN 4
        ELSE 5
    END;

-- ========================================
-- SUMMARY
-- ========================================
SELECT '========================================' AS '';
SELECT 'RENEWAL SYSTEM UPDATE COMPLETED' AS '';
SELECT '========================================' AS '';
SELECT '' AS '';
SELECT 'Changes Applied:' AS '';
SELECT '1. Added payment_mode to LifePolicies table' AS '';
SELECT '2. Added payment_mode to PreviousLifePolicies table' AS '';
SELECT '3. Updated all renewal configurations with correct intervals' AS '';
SELECT '4. Set default payment_mode to Yearly for existing policies' AS '';
SELECT '' AS '';
SELECT 'Reminder Intervals Summary:' AS '';
SELECT '- Most Services: 3 reminders at [30, 15, 7] days' AS '';
SELECT '- Labour Inspection: 5 reminders at [15, 10, 7, 3, 1] days' AS '';
SELECT '- Life Insurance: 3 reminders at [30, 15, 7] days (PPT-based)' AS '';
SELECT '' AS '';
SELECT 'Next Steps:' AS '';
SELECT '1. Restart your backend server' AS '';
SELECT '2. Test Life Insurance form with payment_mode field' AS '';
SELECT '3. Verify renewal reminders are working correctly' AS '';
SELECT '========================================' AS '';
