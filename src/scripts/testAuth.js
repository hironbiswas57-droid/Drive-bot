import { getAuthenticatedDriveClient } from '../auth.js';
import { GoogleDriveService } from '../driveService.js';

async function testDriveConnection() {
  console.log('Testing Google Drive API Connection...');
  try {
    const driveClient = await getAuthenticatedDriveClient();
    const service = new GoogleDriveService(driveClient);

    console.log('Fetching top 5 files from My Drive...');
    const result = await service.searchFiles({ pageSize: 5 });

    console.log(`\nSuccessfully connected! Found ${result.length} files:`);
    result.forEach((file, index) => {
      console.log(`  ${index + 1}. [${file.isFolder ? 'FOLDER' : 'FILE'}] ${file.name} (ID: ${file.id})`);
    });
    console.log('\nAuthentication and permissions verified successfully!');
  } catch (err) {
    console.error('Connection test failed:', err.message);
    process.exit(1);
  }
}

testDriveConnection();
