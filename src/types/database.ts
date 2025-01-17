export interface Partner {
  id: string;  // UUID
  name: string;
  total: number;
  user_id: string;  // UUID
  created_at: string;
}

export interface Transaction {
  id: string;  // UUID
  type: 'credit' | 'debit';
  amount: number;
  date: string;
  description: string;
  category: string;
  partner_id?: string;  // UUID
  user_id: string;  // UUID
  created_at: string;
  files?: FileRecord[];
}

export interface FileRecord {
  id: string;  // UUID
  transaction_id: string;  // UUID
  file_path: string;
  file_name: string;
  content_type: string;
  size: number;
  user_id: string;  // UUID
  created_at: string;
}

export interface LogEntry {
  id: string;  // UUID
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

export interface ActivityLog {
  id: string;  // UUID
  user_id: string;  // UUID
  action: string;
  details: string;
  timestamp: string;
  created_at: string;
}

export interface Tag {
  id: string;  // UUID
  name: string;
  created_at: string;
  user_id: string;  // UUID
}

export interface Note {
  id: string;  // UUID
  title: string;
  content: string;
  user_id: string;  // UUID
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  is_pinned: boolean;
  tags?: Tag[];
}