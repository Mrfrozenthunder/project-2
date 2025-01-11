export interface Partner {
  id: string;
  name: string;
  total: number;
  user_id: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  date: string;
  description: string;
  category: string;
  partner_id?: string;
  user_id: string;
  created_at: string;
  files?: FileRecord[];
}

export interface FileRecord {
  id: string;
  transaction_id: string;
  file_path: string;
  file_name: string;
  content_type: string;
  size: number;
  user_id: string;
  created_at: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  action: string;
  details: string;
}

export interface RunwayInfo {
  days: number;
  isRunwayExhausted: boolean;
  lastSustainableDate: Date;
}

export interface FundingNeed {
  date: string;
  amountNeeded: number;
}