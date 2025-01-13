import React, { useState, useRef } from 'react';
import { Download, Upload, Lock } from 'lucide-react';
import { createBackup, restoreFromBackup } from '../utils/backup';
import type { Transaction, Partner } from '../types/database';

interface BackupRestoreProps {
  transactions: Transaction[];
  partners: Partner[];
  onRestore: (data: { transactions: Transaction[], partners: Partner[] }) => Promise<void>;
}

export const BackupRestore: React.FC<BackupRestoreProps> = ({
  transactions,
  partners,
  onRestore
}) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleBackup = () => {
    try {
      const result = createBackup(transactions, partners);
      if (result.success) {
        setError(null);
      }
    } catch (error) {
      console.error('Backup error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create backup');
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setIsRestoring(true);
    setError(null);
  };

  const handleRestore = async () => {
    if (!selectedFile || !restorePassword) {
      setError('Please select a file and enter the restore password');
      return;
    }

    const confirmed = window.confirm(
      'This will replace all your current data with the backup data. This action cannot be undone. Are you sure you want to continue?'
    );

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      const restoredData = await restoreFromBackup(selectedFile, restorePassword);
      await onRestore(restoredData);
      setIsRestoring(false);
      setRestorePassword('');
      setSelectedFile(null);
    } catch (error) {
      console.error('Restore error:', error);
      setError(
        error instanceof Error 
          ? `Restore failed: ${error.message}` 
          : 'Failed to restore backup'
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <button
          onClick={handleBackup}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Download size={16} />
          Download Backup
        </button>

        <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
          <Upload size={16} />
          {selectedFile ? selectedFile.name : 'Select Backup File'}
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
        </label>
      </div>

      {isRestoring && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-gray-500" />
            <input
              type="password"
              value={restorePassword}
              onChange={(e) => setRestorePassword(e.target.value)}
              placeholder="Enter restore password"
              className="px-3 py-2 border rounded-lg flex-1"
            />
            <button
              onClick={handleRestore}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Restore
            </button>
          </div>
          {selectedFile && (
            <div className="text-sm text-gray-600">
              Selected file: {selectedFile.name}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
    </div>
  );
}; 