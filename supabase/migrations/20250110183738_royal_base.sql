/*
  # Initial Schema Setup for Expense Tracker

  1. New Tables
    - `partners`
      - `id` (uuid, primary key)
      - `name` (text)
      - `total` (decimal)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp)

    - `transactions`
      - `id` (uuid, primary key)
      - `type` (text)
      - `amount` (decimal)
      - `date` (date)
      - `description` (text)
      - `category` (text)
      - `partner_id` (uuid, references partners)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp)

    - `files`
      - `id` (uuid, primary key)
      - `transaction_id` (uuid, references transactions)
      - `file_path` (text)
      - `file_name` (text)
      - `content_type` (text)
      - `size` (bigint)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create partners table
CREATE TABLE partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  total decimal NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name, user_id)
);

-- Enable RLS for partners
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Partners policies
CREATE POLICY "Users can manage their own partners"
  ON partners
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create transactions table
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  amount decimal NOT NULL,
  date date NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  partner_id uuid REFERENCES partners,
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Transactions policies
CREATE POLICY "Users can manage their own transactions"
  ON transactions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create files table
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size bigint NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for files
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Files policies
CREATE POLICY "Users can manage their own files"
  ON files
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_partners_user_id ON partners(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_partner_id ON transactions(partner_id);
CREATE INDEX idx_files_transaction_id ON files(transaction_id);
CREATE INDEX idx_files_user_id ON files(user_id);