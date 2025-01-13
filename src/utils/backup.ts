import * as XLSX from 'xlsx';
import { Transaction, Partner } from '../types/database';
import CryptoJS from 'crypto-js';

// Utility functions for backup and restore
export const createBackup = (transactions: Transaction[], partners: Partner[]) => {
  try {
    console.log('Starting backup creation...');
    
    // Create a backup object with metadata
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {
        transactions,
        partners
      }
    };
    console.log('Backup object created');

    // Convert to encrypted string
    const encryptedData = CryptoJS.AES.encrypt(
      JSON.stringify(backup),
      import.meta.env.VITE_BACKUP_SECRET || 'default-secret'
    ).toString();
    console.log('Data encrypted');

    // Create simple JSON file instead of Excel
    const blob = new Blob(
      [JSON.stringify({ data: encryptedData })], 
      { type: 'application/json' }
    );
    console.log('Blob created');

    // Create and trigger download
    const url = window.URL.createObjectURL(blob);
    const filename = `runway-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    console.log('Triggering download...');
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      console.log('Cleanup completed');
    }, 100);

    return { success: true };
  } catch (error) {
    console.error('Detailed backup error:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    });
    throw new Error('Failed to create backup file');
  }
};

export const restoreFromBackup = async (
  file: File, 
  restorePassword: string
): Promise<{ transactions: Transaction[], partners: Partner[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        // Read JSON data
        const jsonData = JSON.parse(e.target?.result as string);
        
        if (!jsonData.data) {
          throw new Error('Invalid backup file format');
        }

        // Compare passwords directly instead of hashing
        if (restorePassword !== import.meta.env.VITE_RESTORE_PASSWORD_HASH) {
          console.log('Password provided:', restorePassword);
          console.log('Expected password:', import.meta.env.VITE_RESTORE_PASSWORD_HASH);
          throw new Error('Invalid restore password');
        }

        // Decrypt the data
        const decryptedBytes = CryptoJS.AES.decrypt(
          jsonData.data,
          import.meta.env.VITE_BACKUP_SECRET || 'default-secret'
        );
        
        const decryptedData = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));
        
        // Validate backup format
        if (!decryptedData.version || !decryptedData.data) {
          throw new Error('Invalid backup file format');
        }

        resolve(decryptedData.data);
      } catch (error) {
        console.error('Restore error:', error);
        reject(error);
      }
    };

    reader.readAsText(file);
  });
}; 