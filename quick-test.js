// Quick test to check if our task pinning setup is working
console.log('🧪 Testing task pinning setup...');

// Check if our files exist
const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'supabase/migrations/20240123_add_task_pins.sql',
  'app/api/tasks/[id]/pin/route.ts',
  'app/api/tasks/pinned/route.ts',
  'app/components/PinButton.tsx',
  'app/components/PinnedTasksSection.tsx',
  'app/components/PinnedTasksProvider.tsx'
];

console.log('📁 Checking required files...');
let allFilesExist = true;

for (const file of filesToCheck) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
}

if (allFilesExist) {
  console.log('🎉 All required files are present!');
  console.log('📝 Migration SQL preview:');
  
  const migrationContent = fs.readFileSync('supabase/migrations/20240123_add_task_pins.sql', 'utf8');
  console.log(migrationContent.substring(0, 200) + '...');
  
  console.log('\n🔧 Next steps:');
  console.log('1. Apply the migration to your Supabase database');
  console.log('2. Start the dev server: npm run dev');
  console.log('3. Navigate to /knowledge and test pinning tasks');
  
} else {
  console.log('❌ Some files are missing. Please check the file paths.');
}

console.log('\n✅ File check complete!');