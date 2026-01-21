const { RenewalConfig } = require('../models');

// Script to fix reminder intervals to match reminder times and days
const fixReminderIntervals = async () => {
  try {
    console.log('\n========================================');
    console.log('FIXING REMINDER INTERVALS');
    console.log('========================================\n');

    // Get all renewal configs
    const allConfigs = await RenewalConfig.findAll();
    
    console.log(`Found ${allConfigs.length} configurations to check\n`);
    
    for (const config of allConfigs) {
      console.log(`\nChecking: ${config.serviceName} (${config.serviceType})`);
      console.log(`  Current - Reminder Times: ${config.reminderTimes}, Reminder Days: ${config.reminderDays}`);
      console.log(`  Current - Intervals: ${JSON.stringify(config.reminderIntervals)}`);
      
      let newIntervals = [];
      let needsUpdate = false;
      
      // Calculate proper intervals based on reminder days and times
      if (config.serviceType === 'labour_inspection') {
        // Labour Inspection: 15 days, 5 reminders
        // Intervals: 15, 10, 7, 3, 1 days before expiry
        if (config.reminderTimes !== 5 || config.reminderDays !== 15) {
          config.reminderTimes = 5;
          config.reminderDays = 15;
          needsUpdate = true;
        }
        newIntervals = [15, 10, 7, 3, 1];
      } else if (config.serviceType === 'life') {
        // Life Insurance: 30 days, 3 reminders
        // Note: Actual reminders will be based on payment_mode (Monthly/Quarterly/Half-Yearly/Yearly)
        // These are default intervals for yearly payments
        if (config.reminderTimes !== 3 || config.reminderDays !== 30) {
          config.reminderTimes = 3;
          config.reminderDays = 30;
          needsUpdate = true;
        }
        newIntervals = [30, 15, 7];
      } else {
        // All other services: 30 days, 3 reminders
        // Intervals: 30, 15, 7 days before expiry (well distributed)
        if (config.reminderTimes !== 3 || config.reminderDays !== 30) {
          config.reminderTimes = 3;
          config.reminderDays = 30;
          needsUpdate = true;
        }
        newIntervals = [30, 15, 7];
      }
      
      // Check if intervals need update
      const currentIntervals = JSON.stringify(config.reminderIntervals);
      const newIntervalsStr = JSON.stringify(newIntervals);
      
      if (currentIntervals !== newIntervalsStr) {
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await config.update({
          reminderTimes: config.reminderTimes,
          reminderDays: config.reminderDays,
          reminderIntervals: newIntervals
        });
        
        console.log(`  ✅ UPDATED`);
        console.log(`  New - Reminder Times: ${config.reminderTimes}, Reminder Days: ${config.reminderDays}`);
        console.log(`  New - Intervals: ${JSON.stringify(newIntervals)}`);
      } else {
        console.log(`  ✓ Already correct`);
      }
    }
    
    console.log('\n========================================');
    console.log('SUMMARY OF FIXED CONFIGURATIONS');
    console.log('========================================\n');
    
    // Show final state
    const updatedConfigs = await RenewalConfig.findAll({
      order: [['serviceType', 'ASC']]
    });
    
    updatedConfigs.forEach(config => {
      console.log(`${config.serviceName}:`);
      console.log(`  - Reminder Times: ${config.reminderTimes}`);
      console.log(`  - Reminder Days: ${config.reminderDays}`);
      console.log(`  - Intervals: ${JSON.stringify(config.reminderIntervals)}`);
      console.log('');
    });
    
    console.log('========================================');
    console.log('✅ All reminder intervals fixed!');
    console.log('========================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error fixing reminder intervals:', error);
    process.exit(1);
  }
};

// Run the fix
fixReminderIntervals();
