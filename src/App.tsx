import React, { useState, useRef, useEffect } from 'react';
import { PlusCircle, MinusCircle, IndianRupee, Calendar, Eye, Trash2, Filter, SortDesc, FileUp, UserPlus, AlertCircle, LogOut, Paperclip, FileText } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { Auth } from './components/Auth';
import { supabase } from './lib/supabase';
import type { Partner, Transaction, FileRecord, LogEntry, RunwayInfo, FundingNeed } from './types/database';

// Add file size constant at the top with other constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

function App() {
  const { user, signOut } = useAuth();

  // Core state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'credit' | 'debit'>('credit');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{
    type: 'transaction' | 'partner';
    id: string;
  } | null>(null);
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');

  // Sort and filter state
  const [showCreditSort, setShowCreditSort] = useState(false);
  const [showDebitSort, setShowDebitSort] = useState(false);
  const [showCreditFilter, setShowCreditFilter] = useState(false);
  const [showDebitFilter, setShowDebitFilter] = useState(false);
  const [creditSortOption, setCreditSortOption] = useState<string>('date-desc');
  const [debitSortOption, setDebitSortOption] = useState<string>('date-desc');
  const [creditSelectedCategories, setCreditSelectedCategories] = useState<string[]>([]);
  const [debitSelectedCategories, setDebitSelectedCategories] = useState<string[]>([]);
  const [creditSelectedPartners, setCreditSelectedPartners] = useState<string[]>([]);

  // Add new state for payment type
  const [paymentType, setPaymentType] = useState<'White' | 'Black'>('White');
  const [creditSelectedPaymentTypes, setCreditSelectedPaymentTypes] = useState<string[]>([]);
  const [debitSelectedPaymentTypes, setDebitSelectedPaymentTypes] = useState<string[]>([]);

  // Add these refs at the top with other refs
  const creditSortRef = useRef<HTMLDivElement>(null);
  const creditFilterRef = useRef<HTMLDivElement>(null);
  const debitSortRef = useRef<HTMLDivElement>(null);
  const debitFilterRef = useRef<HTMLDivElement>(null);

  // Load data from Supabase
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // Load partners
        const { data: partnersData, error: partnersError } = await supabase
          .from('partners')
          .select('*')
          .eq('user_id', user.id);

        if (partnersError) throw partnersError;
        setPartners(partnersData || []);

        // Load transactions
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select(`
            *,
            files (*)
          `)
          .eq('user_id', user.id);

        if (transactionsError) throw transactionsError;
        setTransactions(transactionsData || []);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [user]);

  // Add this useEffect to handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Credit Sort dropdown
      if (creditSortRef.current && !creditSortRef.current.contains(event.target as Node)) {
        setShowCreditSort(false);
      }
      // Credit Filter dropdown
      if (creditFilterRef.current && !creditFilterRef.current.contains(event.target as Node)) {
        setShowCreditFilter(false);
      }
      // Debit Sort dropdown
      if (debitSortRef.current && !debitSortRef.current.contains(event.target as Node)) {
        setShowDebitSort(false);
      }
      // Debit Filter dropdown
      if (debitFilterRef.current && !debitFilterRef.current.contains(event.target as Node)) {
        setShowDebitFilter(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Derived values
  const creditTransactions = transactions.filter(t => t.type === 'credit');
  const debitTransactions = transactions.filter(t => t.type === 'debit');
  const totalCredits = creditTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalDebits = debitTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalBalance = totalCredits - totalDebits;

  // Get unique categories
  const creditCategories = Array.from(new Set(creditTransactions.map(t => t.category)));
  const debitCategories = Array.from(new Set(debitTransactions.map(t => t.category)));

  // Date formatter
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Calculate runway
  const calculateRunway = (paymentType?: 'White' | 'Black'): RunwayInfo => {
    const filteredTransactions = paymentType 
      ? transactions.filter(t => t.payment_type === paymentType)
      : transactions;

    const sortedTransactions = [...filteredTransactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // If no transactions or only credits, return infinite runway
    if (sortedTransactions.length === 0 || !sortedTransactions.some(t => t.type === 'debit')) {
      return {
        days: Infinity,
        isRunwayExhausted: false,
        lastSustainableDate: new Date('9999-12-31'), // Far future date
        amountNeeded: 0,
        isInfinite: true
      };
    }

    let runningBalance = 0;
    let lastSustainableDate = new Date();
    let isRunwayExhausted = false;
    let amountNeeded = 0;

    for (const transaction of sortedTransactions) {
      if (transaction.type === 'credit') {
        runningBalance += Number(transaction.amount);
      } else {
        runningBalance -= Number(transaction.amount);
        if (runningBalance < 0) {
          lastSustainableDate = new Date(transaction.date);
          isRunwayExhausted = true;
          amountNeeded = Math.abs(runningBalance);
          break;
        }
      }
    }

    const today = new Date();
    const days = Math.ceil((lastSustainableDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // If we never hit negative balance, return infinite runway
    if (!isRunwayExhausted) {
      return {
        days: Infinity,
        isRunwayExhausted: false,
        lastSustainableDate: new Date('9999-12-31'),
        amountNeeded: 0,
        isInfinite: true
      };
    }

    return {
      days,
      isRunwayExhausted,
      lastSustainableDate,
      amountNeeded,
      isInfinite: false
    };
  };

  // Calculate future funding needs
  const calculateFutureNeeds = (paymentType?: 'White' | 'Black'): FundingNeed[] => {
    const filteredTransactions = paymentType 
      ? transactions.filter(t => t.payment_type === paymentType)
      : transactions;

    const runway = calculateRunway(paymentType);
    if (!runway.isRunwayExhausted) return [];

    const lastSustainableDate = runway.lastSustainableDate;
    const futureTransactions = [...filteredTransactions]
      .filter(t => new Date(t.date) > lastSustainableDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = filteredTransactions
      .filter(t => new Date(t.date) <= lastSustainableDate)
      .reduce((sum, t) => sum + (t.type === 'credit' ? Number(t.amount) : -Number(t.amount)), 0);

    const fundingNeeds: FundingNeed[] = [];
    let currentDate = '';
    let currentNeed = 0;

    futureTransactions.forEach(transaction => {
      if (currentDate !== transaction.date) {
        if (currentNeed < 0) {
          fundingNeeds.push({
            date: currentDate,
            amountNeeded: Math.abs(currentNeed)
          });
        }
        currentDate = transaction.date;
      }

      if (transaction.type === 'credit') {
        runningBalance += Number(transaction.amount);
      } else {
        runningBalance -= Number(transaction.amount);
      }

      if (transaction.type === 'debit' && runningBalance < 0) {
        currentNeed = runningBalance;
      } else {
        currentNeed = 0;
      }
    });

    if (currentNeed < 0) {
      fundingNeeds.push({
        date: currentDate,
        amountNeeded: Math.abs(currentNeed)
      });
    }

    return fundingNeeds;
  };

  const runway = calculateRunway();
  const futureNeeds = calculateFutureNeeds();

  // Sort and filter functions
  const getSortedTransactions = (transactions: Transaction[], sortOption: string) => {
    return [...transactions].sort((a, b) => {
      switch (sortOption) {
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'amount-desc':
          return Number(b.amount) - Number(a.amount);
        case 'amount-asc':
          return Number(a.amount) - Number(b.amount);
        default:
          return 0;
      }
    });
  };

  const getFilteredTransactions = (
    transactions: Transaction[],
    selectedCategories: string[],
    selectedPartners: string[] = [],
    selectedPaymentTypes: string[] = []
  ) => {
    return transactions.filter(t => {
      const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(t.category);
      const partnerMatch = selectedPartners.length === 0 || (t.partner_id && selectedPartners.includes(t.partner_id));
      const paymentTypeMatch = selectedPaymentTypes.length === 0 || selectedPaymentTypes.includes(t.payment_type);
      return categoryMatch && partnerMatch && paymentTypeMatch;
    });
  };

  // Handle file upload
  const uploadFile = async (file: File, transactionId: string): Promise<FileRecord | null> => {
    if (!user) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${transactionId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('expense-proofs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: fileRecord, error: fileError } = await supabase
        .from('files')
        .insert({
          transaction_id: transactionId,
          file_path: filePath,
          file_name: file.name,
          content_type: file.type,
          size: file.size,
          user_id: user.id
        })
        .select()
        .single();

      if (fileError) throw fileError;
      return fileRecord;
    } catch (error) {
      console.error('Error handling file:', error);
      return null;
    }
  };

  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_FILE_SIZE) {
        alert('File size exceeds 5MB limit. Please choose a smaller file.');
        e.target.value = ''; // Reset file input
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    }
  };

  // Handle file view
  const handleViewFile = async (transaction: Transaction) => {
    if (!transaction.files?.[0]) return;

    try {
      const { data, error } = await supabase.storage
        .from('expense-proofs')
        .createSignedUrl(transaction.files[0].file_path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing file:', error);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { data: newTransaction, error: transactionError } = await supabase
        .from('transactions')
        .insert([
          {
            amount,
            type: activeTab,
            category,
            description,
            partner_id: activeTab === 'credit' ? selectedPartnerId : null,
            date: transactionDate,
            user_id: user.id,
            payment_type: paymentType
          }
        ])
        .select(`
          *,
          files (*)
        `)
        .single();

      if (transactionError) throw transactionError;

      // Handle file upload for debit transactions
      if (activeTab === 'debit' && selectedFile && newTransaction) {
        const fileRecord = await uploadFile(selectedFile, newTransaction.id);
        if (fileRecord) {
          newTransaction.files = [fileRecord];
        }
      }

      // Update transactions state immediately
      setTransactions(prev => {
        const updatedTransactions = [...prev];
        const existingIndex = updatedTransactions.findIndex(t => t.id === newTransaction.id);
        
        if (existingIndex >= 0) {
          updatedTransactions[existingIndex] = newTransaction;
        } else {
          updatedTransactions.push(newTransaction);
        }
        
        return updatedTransactions;
      });

      // Update partners state immediately for credit transactions
      if (activeTab === 'credit' && selectedPartnerId) {
        setPartners(prev => prev.map(partner => {
          if (partner.id === selectedPartnerId) {
            return {
              ...partner,
              total: Number(partner.total) + Number(amount)
            };
          }
          return partner;
        }));
      }

      // Add log entry
      addLogEntry(
        activeTab === 'credit' ? 'Credit Added' : 'Debit Added',
        activeTab === 'credit'
          ? `₹${amount} credited by ${partners.find(p => p.id === selectedPartnerId)?.name}`
          : `₹${amount} debited for ${description}`
      );

      // Reset form
      setAmount('');
      setDescription('');
      setCategory('');
      setSelectedPartnerId('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Reset payment type along with other form fields
      setPaymentType('White');
    } catch (error) {
      console.error('Error adding transaction:', error);
      
      // Refresh partner data from database if something went wrong
      const { data: refreshedPartners } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', user.id);

      if (refreshedPartners) {
        setPartners(refreshedPartners);
      }
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!showDeleteConfirm || !user) return;

    try {
      if (showDeleteConfirm.type === 'transaction') {
        const transaction = transactions.find(t => t.id === showDeleteConfirm.id);
        if (!transaction) return;

        // Delete associated files first
        if (transaction.files?.length) {
          for (const file of transaction.files) {
            await supabase.storage
              .from('expense-proofs')
              .remove([file.file_path]);

            await supabase
              .from('files')
              .delete()
              .eq('id', file.id);
          }
        }

        // Delete transaction
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', showDeleteConfirm.id);

        if (error) throw error;

        // Update transactions state immediately
        setTransactions(prev => prev.filter(t => t.id !== showDeleteConfirm.id));

        // Update partners state immediately for credit transactions
        if (transaction.type === 'credit' && transaction.partner_id) {
          setPartners(prev => prev.map(partner => {
            if (partner.id === transaction.partner_id) {
              return {
                ...partner,
                total: Number(partner.total) - Number(transaction.amount)
              };
            }
            return partner;
          }));
        }
        
        addLogEntry(
          'Transaction Deleted',
          `${transaction.type === 'credit' ? 'Credit' : 'Debit'} of ₹${transaction.amount} deleted`
        );
      } else if (showDeleteConfirm.type === 'partner') {
        const partner = partners.find(p => p.id === showDeleteConfirm.id);
        if (!partner) return;

        const { error } = await supabase
          .from('partners')
          .delete()
          .eq('id', showDeleteConfirm.id);

        if (error) throw error;

        setPartners(prev => prev.filter(p => p.id !== showDeleteConfirm.id));
        
        addLogEntry(
          'Partner Removed',
          `${partner.name} removed from partners list`
        );
      }
    } catch (error) {
      console.error('Error deleting:', error);
      
      // Refresh partner data from database if something went wrong
      const { data: refreshedPartners } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', user.id);

      if (refreshedPartners) {
        setPartners(refreshedPartners);
      }
    }

    setShowDeleteConfirm(null);
  };

  // Handle adding new partner
  const handleAddPartner = async (name: string) => {
    if (!user) return;

    try {
      const { data: newPartner, error } = await supabase
        .from('partners')
        .insert({
          name,
          user_id: user.id,
          total: 0
        })
        .select()
        .single();

      if (error) throw error;

      setPartners(prev => [...prev, newPartner]);
      addLogEntry('Partner Added', `${name} added as a new partner`);
    } catch (error) {
      console.error('Error adding partner:', error);
    }
  };

  // Add log entry
  const addLogEntry = (action: string, details: string) => {
    const newLog: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      action,
      details,
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // Get filtered and sorted transactions
  const filteredSortedCreditTransactions = getSortedTransactions(
    getFilteredTransactions(
      creditTransactions,
      creditSelectedCategories,
      creditSelectedPartners,
      creditSelectedPaymentTypes
    ),
    creditSortOption
  );

  const filteredSortedDebitTransactions = getSortedTransactions(
    getFilteredTransactions(
      debitTransactions,
      debitSelectedCategories,
      [],
      debitSelectedPaymentTypes
    ),
    debitSortOption
  );

  // Add these helper functions for filtered calculations
  const calculateSummary = (filteredTransactions: Transaction[]) => {
    const credits = filteredTransactions.filter(t => t.type === 'credit');
    const debits = filteredTransactions.filter(t => t.type === 'debit');
    const totalCredits = credits.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalDebits = debits.reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      totalCredits,
      totalDebits,
      totalBalance: totalCredits - totalDebits
    };
  };

  // If not authenticated, show auth form
  if (!user) {
    return <Auth />;
  }

  // Add this helper function near your other utility functions
  const formatToLakhs = (amount: number): string => {
    const inLakhs = amount / 100000;
    return `₹${inLakhs.toFixed(2)}L`;
  };

  // Update the transaction history entries with better delete button positioning
  const TransactionHistoryEntry = ({ transaction }: { transaction: Transaction }) => (
    <div key={transaction.id} className="bg-gray-50 rounded-lg p-4 mb-3 group h-28">
      <div className="flex justify-between items-start h-full">
        <div className="flex-grow flex flex-col justify-between h-full">
          <div>
            <h3 className="font-medium text-gray-800 mb-1 line-clamp-1">
              {transaction.description || 'No description'}
            </h3>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">{formatDate(transaction.date)}</p>
              <p className="text-sm text-gray-500">{transaction.category}</p>
              <p className="text-sm text-gray-500">
                {partners.find(p => p.id === transaction.partner_id)?.name}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 h-full">
          <button
            onClick={() => setShowDeleteConfirm({ type: 'transaction', id: transaction.id })}
            className="p-1.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-red-50"
          >
            <Trash2 size={16} />
          </button>
          <div className="text-right flex flex-col justify-between h-full">
            <p className="text-lg font-bold text-green-600">
              {formatToLakhs(Number(transaction.amount))}
            </p>
            <span className={`text-xs px-2 py-1 rounded-full ${
              transaction.payment_type === 'White' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-800 text-white'
            }`}>
              {transaction.payment_type}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // Update the runway display in all summaries
  const RunwayDisplay = ({ runway }: { runway: RunwayInfo }) => (
    <>
      <p className={`text-xl font-bold ${
        runway.isInfinite ? 'text-green-600' : 
        runway.days >= 0 ? 'text-green-600' : 'text-red-600'
      }`}>
        {runway.isInfinite ? '∞' : `${runway.days} days`}
      </p>
      <p className="text-xs text-gray-500">
        {runway.isInfinite ? 'Sustainable indefinitely' :
         runway.days >= 0 ? 
           `Until ${formatDate(runway.lastSustainableDate)}` :
           `Exhausted since ${formatDate(runway.lastSustainableDate)}`
        }
      </p>
      {!runway.isInfinite && runway.isRunwayExhausted && (
        <div className="mt-1 p-1 bg-red-50 rounded">
          <p className="text-xs font-medium text-red-800">
            Need: {formatToLakhs(runway.amountNeeded)}
          </p>
        </div>
      )}
    </>
  );

  // Add this new component
  const TransactionTimeline = ({ transactions }: { transactions: Transaction[] }) => {
    // Group transactions by date
    const groupedTransactions = transactions.reduce((acc, transaction) => {
      const date = transaction.date;
      if (!acc[date]) {
        acc[date] = { credits: [], debits: [] };
      }
      if (transaction.type === 'credit') {
        acc[date].credits.push(transaction);
      } else {
        acc[date].debits.push(transaction);
      }
      return acc;
    }, {} as Record<string, { credits: Transaction[], debits: Transaction[] }>);

    // Convert to sorted array
    const sortedDates = Object.keys(groupedTransactions).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );

    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Transaction Timeline</h2>
        
        {/* Headers */}
        <div className="grid grid-cols-[1fr,auto,1fr] gap-4 mb-6">
          <div className="text-right text-lg font-medium text-green-600">Credit Flow</div>
          <div></div>
          <div className="text-left text-lg font-medium text-red-600">Debit Flow</div>
        </div>

        <div className="relative">
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-200 transform -translate-x-1/2" />
          
          {/* Transactions */}
          <div className="relative space-y-8">
            {sortedDates.map((date) => {
              const dayTransactions = groupedTransactions[date];
              const totalCredits = dayTransactions.credits.reduce((sum, t) => sum + Number(t.amount), 0);
              const totalDebits = dayTransactions.debits.reduce((sum, t) => sum + Number(t.amount), 0);
              
              return (
                <div key={date} className="relative">
                  {/* Date marker */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 bg-white px-2 text-xs text-gray-500 z-10">
                    {formatDate(date)}
                  </div>

                  <div className="grid grid-cols-[1fr,auto,1fr] gap-4 relative">
                    {/* Credits */}
                    <div className="flex justify-end items-center">
                      {dayTransactions.credits.length > 0 && (
                        <div className="group relative">
                          <div className="flex items-center">
                            <div className="bg-green-100 text-green-800 px-3 py-2 rounded-lg flex items-center justify-center cursor-pointer transform transition-transform group-hover:scale-105">
                              <span className="font-medium text-sm">
                                {formatToLakhs(totalCredits)}
                              </span>
                            </div>
                            <div className="w-4 h-0.5 bg-gray-200" />
                          </div>
                          
                          {/* Credits Hover Card */}
                          <div className="absolute top-full mt-2 right-[120%] w-64 bg-white rounded-lg shadow-lg p-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <div className="text-sm space-y-2">
                              {dayTransactions.credits.map((transaction) => (
                                <div key={transaction.id} className="border-b last:border-0 pb-2 last:pb-0">
                                  <p className="font-medium text-gray-800">
                                    {formatToLakhs(Number(transaction.amount))}
                                  </p>
                                  <p className="text-gray-600">{transaction.description}</p>
                                  <p className="text-gray-600">{transaction.category}</p>
                                  <p className="text-gray-600">
                                    {partners.find(p => p.id === transaction.partner_id)?.name}
                                  </p>
                                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${
                                    transaction.payment_type === 'White' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-800 text-white'
                                  }`}>
                                    {transaction.payment_type}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Center point */}
                    <div className="w-3 h-3 bg-gray-300 rounded-full self-center" />

                    {/* Debits */}
                    <div className="flex justify-start items-center">
                      {dayTransactions.debits.length > 0 && (
                        <div className="group relative">
                          <div className="flex items-center">
                            <div className="w-4 h-0.5 bg-gray-200" />
                            <div className="bg-red-100 text-red-800 px-3 py-2 rounded-lg flex items-center justify-center cursor-pointer transform transition-transform group-hover:scale-105">
                              <span className="font-medium text-sm">
                                {formatToLakhs(totalDebits)}
                              </span>
                            </div>
                          </div>

                          {/* Debits Hover Card */}
                          <div className="absolute top-full mt-2 left-[120%] w-64 bg-white rounded-lg shadow-lg p-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <div className="text-sm space-y-2">
                              {dayTransactions.debits.map((transaction) => (
                                <div key={transaction.id} className="border-b last:border-0 pb-2 last:pb-0">
                                  <p className="font-medium text-gray-800">
                                    {formatToLakhs(Number(transaction.amount))}
                                  </p>
                                  <p className="text-gray-600">{transaction.description}</p>
                                  <p className="text-gray-600">{transaction.category}</p>
                                  {transaction.files?.length > 0 && (
                                    <button
                                      onClick={() => handleViewFile(transaction)}
                                      className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 mt-1"
                                    >
                                      <FileText size={12} />
                                      View Proof
                                    </button>
                                  )}
                                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${
                                    transaction.payment_type === 'White' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-800 text-white'
                                  }`}>
                                    {transaction.payment_type}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header with Logout */}
        <div className="flex justify-between items-center mb-8">
          <div className="w-10"> {/* Empty div for balance */}
          </div>
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Shared Gym Project Runway Tracker
            </h1>
            <div className="h-1 w-32 bg-blue-600 mx-auto rounded-full"></div>
          </div>
          <div className="w-10"> {/* Width matches left empty div */}
            <button
              onClick={() => signOut()}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Overall Summary Panel */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Overall Summary</h2>
          
          {/* Combined Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Combined Pool Balance</p>
                <p className={`text-3xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatToLakhs(totalBalance)}
                </p>
                <div className="mt-2 text-sm text-gray-500">
                  <div>Credits: <span className="text-green-600">{formatToLakhs(totalCredits)}</span></div>
                  <div>Debits: <span className="text-red-600">{formatToLakhs(totalDebits)}</span></div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Combined Runway</p>
                <RunwayDisplay runway={runway} />
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Combined Future Needs</p>
                <p className="text-3xl font-bold text-orange-500">{futureNeeds.length} dates</p>
                <div className="mt-2 h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                     style={{ scrollbarWidth: 'thin' }}>
                  {futureNeeds.map((need, index) => (
                    <div key={index} className="text-sm p-1">
                      <span className="text-gray-600">{formatDate(need.date)}:</span>
                      <span className="text-red-600 font-medium ml-2">
                        {formatToLakhs(need.amountNeeded)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* White and Black Summaries */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* White Pool Summary */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-green-800">White Pool Summary</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Balance</p>
                  {(() => {
                    const whiteSummary = calculateSummary(getFilteredTransactions(transactions, [], [], ['White']));
                    return (
                      <>
                        <p className={`text-xl font-bold ${whiteSummary.totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatToLakhs(whiteSummary.totalBalance)}
                        </p>
                        <div className="mt-2 text-xs text-gray-500">
                          <div>Credits: <span className="text-green-600">{formatToLakhs(whiteSummary.totalCredits)}</span></div>
                          <div>Debits: <span className="text-red-600">{formatToLakhs(whiteSummary.totalDebits)}</span></div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Runway</p>
                  {(() => {
                    const whiteRunway = calculateRunway('White');
                    return (
                      <>
                        <RunwayDisplay runway={whiteRunway} />
                      </>
                    );
                  })()}
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Future Needs</p>
                  {(() => {
                    const whiteFutureNeeds = calculateFutureNeeds('White');
                    return (
                      <>
                        <p className="text-xl font-bold text-orange-500">{whiteFutureNeeds.length} dates</p>
                        <div className="mt-1 h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                             style={{ scrollbarWidth: 'thin' }}>
                          {whiteFutureNeeds.map((need, index) => (
                            <div key={index} className="p-0.5">
                              <span className="text-gray-600">{formatDate(need.date)}:</span>
                              <span className="text-red-600 font-medium ml-1">
                                {formatToLakhs(need.amountNeeded)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Black Pool Summary */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-white">Black Pool Summary</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-400 mb-1">Balance</p>
                  {(() => {
                    const blackSummary = calculateSummary(getFilteredTransactions(transactions, [], [], ['Black']));
                    return (
                      <>
                        <p className={`text-xl font-bold ${blackSummary.totalBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                          {formatToLakhs(blackSummary.totalBalance)}
                        </p>
                        <div className="mt-2 text-xs text-gray-400">
                          <div>Credits: <span className="text-green-400">{formatToLakhs(blackSummary.totalCredits)}</span></div>
                          <div>Debits: <span className="text-red-400">{formatToLakhs(blackSummary.totalDebits)}</span></div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-400 mb-1">Runway</p>
                  {(() => {
                    const blackRunway = calculateRunway('Black');
                    return (
                      <>
                        <RunwayDisplay runway={blackRunway} />
                      </>
                    );
                  })()}
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-400 mb-1">Future Needs</p>
                  {(() => {
                    const blackFutureNeeds = calculateFutureNeeds('Black');
                    return (
                      <>
                        <p className="text-xl font-bold text-red-400">{blackFutureNeeds.length} dates</p>
                        <div className="mt-1 h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                             style={{ scrollbarWidth: 'thin' }}>
                          {blackFutureNeeds.map((need, index) => (
                            <div key={index} className="p-0.5">
                              <span className="text-gray-400">{formatDate(need.date)}:</span>
                              <span className="text-red-400 font-medium ml-1">
                                {formatToLakhs(need.amountNeeded)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Partner Contributions */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Partners</h2>
            </div>
            <button
              onClick={() => setShowAddPartner(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Add New Partner"
            >
              <UserPlus size={20} className="text-blue-600" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {partners.map(partner => {
              const whiteAmount = transactions
                .filter(t => t.partner_id === partner.id && t.type === 'credit' && t.payment_type === 'White')
                .reduce((sum, t) => sum + Number(t.amount), 0);
              
              const blackAmount = transactions
                .filter(t => t.partner_id === partner.id && t.type === 'credit' && t.payment_type === 'Black')
                .reduce((sum, t) => sum + Number(t.amount), 0);

              return (
                <div key={partner.id} className="bg-gray-50 rounded-lg p-4 relative group">
                  <button
                    onClick={() => setShowDeleteConfirm({ type: 'partner', id: partner.id })}
                    className="absolute top-2 right-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                  
                  {/* Partner Name and Total */}
                  <div className="mb-3">
                    <h3 className="font-medium text-gray-800">{partner.name}</h3>
                    <p className="text-green-600 font-bold text-lg">
                      {formatToLakhs(Number(partner.total))}
                    </p>
                    <p className="text-xs text-gray-500">
                      {((Number(partner.total) / (totalCredits || 1)) * 100).toFixed(1)}% of total pool
                    </p>
                  </div>

                  {/* Contribution Breakdown */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-white rounded-md px-3 py-1.5">
                      <span className="flex items-center">
                        <span className="w-5 h-5 flex items-center justify-center bg-green-100 text-green-800 rounded text-xs font-medium">
                          W
                        </span>
                        <span className="ml-2 text-sm text-gray-600">White</span>
                      </span>
                      <span className="text-sm font-medium text-gray-800">
                        {formatToLakhs(whiteAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-md px-3 py-1.5">
                      <span className="flex items-center">
                        <span className="w-5 h-5 flex items-center justify-center bg-gray-800 text-white rounded text-xs font-medium">
                          B
                        </span>
                        <span className="ml-2 text-sm text-gray-600">Black</span>
                      </span>
                      <span className="text-sm font-medium text-gray-800">
                        {formatToLakhs(blackAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-gray-800"
                      style={{ 
                        width: '100%',
                        background: `linear-gradient(to right, #22c55e ${(whiteAmount / Number(partner.total)) * 100}%, #1f2937 ${(whiteAmount / Number(partner.total)) * 100}%)`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transaction Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab('credit')}
              className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 ${
                activeTab === 'credit'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <PlusCircle size={20} /> Credit
            </button>
            <button
              onClick={() => setActiveTab('debit')}
              className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 ${
                activeTab === 'debit'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <MinusCircle size={20} /> Debit
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'credit' && (
              <>
                {/* First Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="partner" className="block text-sm font-medium text-gray-700 mb-1">
                      Select Partner
                    </label>
                    <select
                      id="partner"
                      value={selectedPartnerId}
                      onChange={(e) => setSelectedPartnerId(e.target.value)}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a partner</option>
                      {partners.map(partner => (
                        <option key={partner.id} value={partner.id}>{partner.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="number"
                        id="amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Type
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentType('White')}
                        className={`flex-1 py-2 px-3 rounded-lg ${
                          paymentType === 'White'
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                        }`}
                      >
                        White
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType('Black')}
                        className={`flex-1 py-2 px-3 rounded-lg ${
                          paymentType === 'Black'
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                        }`}
                      >
                        Black
                      </button>
                    </div>
                  </div>
                </div>

                {/* Second Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter category"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter description"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="date"
                        id="date"
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
                        className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Debit Entry Form */}
            {activeTab === 'debit' && (
              <>
                {/* First Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="number"
                        id="amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Type
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentType('White')}
                        className={`flex-1 py-2 px-3 rounded-lg ${
                          paymentType === 'White'
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                        }`}
                      >
                        White
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType('Black')}
                        className={`flex-1 py-2 px-3 rounded-lg ${
                          paymentType === 'Black'
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                        }`}
                      >
                        Black
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="date"
                        id="date"
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
                        className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Second Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter category"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter description"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">
                      Expense Proof
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        id="file"
                        ref={fileInputRef}
                        accept=".pdf,image/*"
                        onChange={handleFileChange}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <FileUp className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    </div>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className={`w-full py-2 px-4 rounded-lg text-white font-medium ${
                activeTab === 'credit' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Add {activeTab === 'credit' ? 'Credit' : 'Debit'}
            </button>
          </form>
        </div>

        {/* Transaction History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Credit History */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-green-600">Credit History</h2>
              <div className="flex gap-2">
                <div className="relative" ref={creditSortRef}>
                  <button
                    onClick={() => {
                      setShowCreditSort(!showCreditSort);
                      setShowCreditFilter(false);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <SortDesc size={20} className="text-gray-600" />
                  </button>
                  {showCreditSort && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg p-2 z-10 min-w-[200px]">
                      <button
                        onClick={() => setCreditSortOption('date-desc')}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 rounded ${
                          creditSortOption === 'date-desc' ? 'bg-gray-100' : ''
                        }`}
                      >
                        Date (Newest First)
                      </button>
                      <button
                        onClick={() => setCreditSortOption('date-asc')}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 rounded ${
                          creditSortOption === 'date-asc' ? 'bg-gray-100' : ''
                        }`}
                      >
                        Date (Oldest First)
                      </button>
                      <button
                        onClick={() => setCreditSortOption('amount-desc')}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 rounded ${
                          creditSortOption === 'amount-desc' ? 'bg-gray-100' : ''
                        }`}
                      >
                        Amount (High to Low)
                      </button>
                      <button
                        onClick={() => setCreditSortOption('amount-asc')}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 rounded ${
                          creditSortOption === 'amount-asc' ? 'bg-gray-100' : ''
                        }`}
                      >
                        Amount (Low to High)
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative" ref={creditFilterRef}>
                  <button
                    onClick={() => {
                      setShowCreditFilter(!showCreditFilter);
                      setShowCreditSort(false);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Filter size={20} className="text-gray-600" />
                  </button>
                  {showCreditFilter && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg p-2 z-10 min-w-[200px]">
                      <div className="mb-2 border-b pb-2">
                        <p className="px-4 py-1 text-sm font-medium text-gray-700">Categories</p>
                        {creditCategories.map(category => (
                          <label
                            key={category}
                            className="flex items-center px-4 py-2 hover:bg-gray-100 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={creditSelectedCategories.includes(category)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCreditSelectedCategories([...creditSelectedCategories, category]);
                                } else {
                                  setCreditSelectedCategories(creditSelectedCategories.filter(c => c !== category));
                                }
                              }}
                              className="mr-2"
                            />
                            {category}
                          </label>
                        ))}
                      </div>
                      <div>
                        <p className="px-4 py-1 text-sm font-medium text-gray-700">Partners</p>
                        {partners.map(partner => (
                          <label
                            key={partner.id}
                            className="flex items-center px-4 py-2 hover:bg-gray-100 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={creditSelectedPartners.includes(partner.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCreditSelectedPartners([...creditSelectedPartners, partner.id]);
                                } else {
                                  setCreditSelectedPartners(creditSelectedPartners.filter(id => id !== partner.id));
                                }
                              }}
                              className="mr-2"
                            />
                            {partner.name}
                          </label>
                        ))}
                      </div>
                      <div className="mb-2 border-b pb-2">
                        <p className="px-4 py-1 text-sm font-medium text-gray-700">Payment Type</p>
                        {['White', 'Black'].map(type => (
                          <label
                            key={type}
                            className="flex items-center px-4 py-2 hover:bg-gray-100 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={creditSelectedPaymentTypes.includes(type)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCreditSelectedPaymentTypes([...creditSelectedPaymentTypes, type]);
                                } else {
                                  setCreditSelectedPaymentTypes(creditSelectedPaymentTypes.filter(t => t !== type));
                                }
                              }}
                              className="mr-2"
                            />
                            {type}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="h-[32rem] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                 style={{ scrollbarWidth: 'thin' }}>
              {filteredSortedCreditTransactions.map(transaction => (
                <TransactionHistoryEntry key={transaction.id} transaction={transaction} />
              ))}
            </div>
          </div>

          {/* Debit History */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-red-600">Debit History</h2>
              <div className="flex gap-2">
                <div className="relative" ref={debitSortRef}>
                  <button
                    onClick={() => {
                      setShowDebitSort(!showDebitSort);
                      setShowDebitFilter(false);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <SortDesc size={20} className="text-gray-600" />
                  </button>
                  {showDebitSort && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg p-2 z-10 min-w-[200px]">
                      <button
                        onClick={() => setDebitSortOption('date-desc')}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 rounded ${
                          debitSortOption === 'date-desc' ? 'bg-gray-100' : ''
                        }`}
                      >
                        Date (Newest First)
                      </button>
                      <button
                        onClick={() => setDebitSortOption('date-asc')}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 rounded ${
                          debitSortOption === 'date-asc' ? 'bg-gray-100' : ''
                        }`}
                      >
                        Date (Oldest First)
                      </button>
                      <button
                        onClick={() => setDebitSortOption('amount-desc')}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 rounded ${
                          debitSortOption === 'amount-desc' ? 'bg-gray-100' : ''
                        }`}
                      >
                        Amount (High to Low)
                      </button>
                      <button
                        onClick={() => setDebitSortOption('amount-asc')}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 rounded ${
                          debitSortOption === 'amount-asc' ? 'bg-gray-100' : ''
                        }`}
                      >
                        Amount (Low to High)
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative" ref={debitFilterRef}>
                  <button
                    onClick={() => {
                      setShowDebitFilter(!showDebitFilter);
                      setShowDebitSort(false);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Filter size={20} className="text-gray-600" />
                  </button>
                  {showDebitFilter && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg p-2 z-10 min-w-[200px]">
                      <div className="mb-2 border-b pb-2">
                        <p className="px-4 py-1 text-sm font-medium text-gray-700">Categories</p>
                        {debitCategories.map(category => (
                          <label
                            key={category}
                            className="flex items-center px-4 py-2 hover:bg-gray-100 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={debitSelectedCategories.includes(category)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDebitSelectedCategories([...debitSelectedCategories, category]);
                                } else {
                                  setDebitSelectedCategories(debitSelectedCategories.filter(c => c !== category));
                                }
                              }}
                              className="mr-2"
                            />
                            {category}
                          </label>
                        ))}
                      </div>
                      <div>
                        <p className="px-4 py-1 text-sm font-medium text-gray-700">Payment Type</p>
                        {['White', 'Black'].map(type => (
                          <label
                            key={type}
                            className="flex items-center px-4 py-2 hover:bg-gray-100 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={debitSelectedPaymentTypes.includes(type)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDebitSelectedPaymentTypes([...debitSelectedPaymentTypes, type]);
                                } else {
                                  setDebitSelectedPaymentTypes(debitSelectedPaymentTypes.filter(t => t !== type));
                                }
                              }}
                              className="mr-2"
                            />
                            {type}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="h-[32rem] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                 style={{ scrollbarWidth: 'thin' }}>
              {filteredSortedDebitTransactions.map(transaction => (
                <div key={transaction.id} className="bg-gray-50 rounded-lg p-4 mb-3 group h-28">
                  <div className="flex justify-between items-start h-full">
                    <div className="flex-grow flex flex-col justify-between h-full">
                      <div>
                        <h3 className="font-medium text-gray-800 mb-1 line-clamp-1">
                          {transaction.description || 'No description'}
                        </h3>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-500">{formatDate(transaction.date)}</p>
                          <p className="text-sm text-gray-500">{transaction.category}</p>
                          {transaction.files?.length > 0 && (
                            <button
                              onClick={() => handleViewFile(transaction)}
                              className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 mt-1"
                            >
                              <FileText size={16} />
                              View Proof
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 h-full">
                      <button
                        onClick={() => setShowDeleteConfirm({ type: 'transaction', id: transaction.id })}
                        className="p-1.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="text-right flex flex-col justify-between h-full">
                        <p className="text-lg font-bold text-red-600" style={{ color: '#dc2626' }}>
                          {formatToLakhs(Number(transaction.amount))}
                        </p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          transaction.payment_type === 'White' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-800 text-white'
                        }`}>
                          {transaction.payment_type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline (new position) */}
        <TransactionTimeline transactions={transactions} />

        {/* Activity Log */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Activity Log</h2>
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 text-sm">
                <div className="text-gray-500 whitespace-nowrap">
                  {formatDate(log.timestamp)}
                </div>
                <div>
                  <span className="font-medium text-gray-700">{log.action}</span>
                  <span className="text-gray-600"> - {log.details}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Partner Modal */}
      {showAddPartner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Add New Partner</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newPartnerName.trim()) {
                handleAddPartner(newPartnerName.trim());
                setNewPartnerName('');
                setShowAddPartner(false);
              }
            }}>
              <input
                type="text"
                value={newPartnerName}
                onChange={(e) => setNewPartnerName(e.target.value)}
                placeholder="Enter partner name"
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 mb-4"
                required
              />
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowAddPartner(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Add Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this {showDeleteConfirm.type}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;