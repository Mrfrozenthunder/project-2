import React, { useState, useMemo } from 'react';
import { Transaction } from '../types/database';
import { formatToLakhs } from '../utils/format';

type PaymentTypeTab = 'all' | 'white' | 'black';

interface BalanceGraphProps {
  transactions: Transaction[];
}

export const BalanceGraph: React.FC<BalanceGraphProps> = ({ transactions }) => {
  const [activeTab, setActiveTab] = useState<PaymentTypeTab>('all');

  const { dailyBalances, dates, maxBalance, minBalance } = useMemo(() => {
    const filteredTransactions = transactions
      .filter(t => activeTab === 'all' || t.payment_type.toLowerCase() === activeTab)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const dailyBalances: Record<string, { balance: number; hasTransaction: boolean }> = {};

    // Get all transaction dates
    const transactionDates = Array.from(new Set(filteredTransactions.map(t => t.date))).sort();
    
    // Create continuous date range
    const startDate = new Date(transactionDates[0]);
    const endDate = new Date(transactionDates[transactionDates.length - 1]);
    const dateRange: string[] = [];

    for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dateRange.push(dateStr);
      
      const dayTransactions = filteredTransactions.filter(t => t.date === dateStr);
      const dayBalance = dayTransactions.reduce((sum, t) => 
        sum + (t.type === 'credit' ? Number(t.amount) : -Number(t.amount)), 0);
      
      if (dayTransactions.length > 0) {
        runningBalance += dayBalance;
        dailyBalances[dateStr] = { 
          balance: runningBalance,
          hasTransaction: true 
        };
      } else {
        // Use previous balance but mark as no transaction
        dailyBalances[dateStr] = { 
          balance: runningBalance,
          hasTransaction: false 
        };
      }
    }

    const balances = Object.values(dailyBalances).map(d => d.balance);
    const maxBalance = Math.max(...balances, 0);
    const minBalance = Math.min(...balances, 0);

    return {
      dailyBalances,
      dates: dateRange,
      maxBalance,
      minBalance
    };
  }, [transactions, activeTab]);

  const range = maxBalance - minBalance;
  const padding = range * 0.1;
  const xPadding = 0.02; // 2% padding on x-axis

  // Calculate Y-axis ticks with 0 and proportional spacing
  const getYAxisTicks = () => {
    const ticks = [0]; // Always include 0
    
    // Add positive ticks (ascending order)
    if (maxBalance > 0) {
      const positiveStep = maxBalance / 3;
      for (let i = positiveStep; i <= maxBalance + padding; i += positiveStep) {
        ticks.unshift(Math.round(i)); // unshift to add at beginning
      }
    }
    
    // Add negative ticks (descending order)
    if (minBalance < 0) {
      const negativeStep = Math.abs(minBalance) / 3;
      for (let i = -negativeStep; i >= minBalance - padding; i -= negativeStep) {
        ticks.push(Math.round(i)); // push to add at end
      }
    }
    
    return ticks;
  };

  const yAxisTicks = getYAxisTicks();

  const getPointColor = (balance: number) => {
    // Always use green for positive and red for negative, regardless of tab
    return balance >= 0 ? '#059669' : '#ef4444';
  };

  // Helper function to calculate x position with padding
  const getXPosition = (index: number, total: number) => {
    const paddedPosition = (index / (total - 1)) * (1 - 2 * xPadding) + xPadding;
    return paddedPosition * 100;
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-gray-200 text-gray-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab('white')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'white'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          White
        </button>
        <button
          onClick={() => setActiveTab('black')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'black'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Black
        </button>
      </div>

      {/* Graph */}
      <div className="border rounded-lg p-6 pb-20 bg-white">
        <div className="min-w-[800px] h-[400px] relative">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-24 flex flex-col justify-between text-sm text-gray-500">
            {yAxisTicks.map((tick, i) => (
              <span 
                key={i} 
                className="text-right pr-2 -translate-y-1/2 absolute right-0"
                style={{
                  top: `${((maxBalance + padding - tick) / (range + 2 * padding)) * 100}%`
                }}
              >
                {formatToLakhs(tick, false)}
              </span>
            ))}
          </div>

          {/* Graph area */}
          <div className="absolute left-28 right-4 top-4 bottom-8">
            {/* Regular grid lines - behind everything */}
            <div className="absolute inset-0" style={{ zIndex: 1 }}>
              {yAxisTicks.map((tick, i) => (
                <div
                  key={i}
                  className={`absolute left-0 right-0 border-t ${
                    tick === 0 
                      ? 'border-gray-400 border-dashed' 
                      : 'border-gray-100'
                  }`}
                  style={{
                    top: `${((maxBalance + padding - tick) / (range + 2 * padding)) * 100}%`
                  }}
                />
              ))}
            </div>

            {/* Graph area with gradients and lines */}
            <div className="absolute inset-0" style={{ zIndex: 2 }}>
              <svg 
                className="w-full h-full" 
                viewBox={`0 0 100 100`} 
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="positive-gradient" gradientTransform="rotate(90)">
                    <stop offset="0%" stopColor="#059669" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.1" />
                  </linearGradient>
                  <linearGradient id="negative-gradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity="0.1" />
                  </linearGradient>
                </defs>

                {/* Update gradient paths for stepped effect */}
                {/* Positive area fill */}
                <path
                  d={`
                    M ${getXPosition(0, dates.length)} ${((maxBalance + padding) / (range + 2 * padding)) * 100}
                    ${dates.map((date, i) => {
                      const x = getXPosition(i, dates.length);
                      const y = ((maxBalance + padding - Math.max(0, dailyBalances[date].balance)) / (range + 2 * padding)) * 100;
                      const zeroY = ((maxBalance + padding) / (range + 2 * padding)) * 100;
                      
                      if (i === 0) return `M ${x} ${zeroY} L ${x} ${y}`;
                      
                      return `H ${x} V ${y}`;
                    }).join(' ')}
                    H ${getXPosition(dates.length - 1, dates.length)}
                    V ${((maxBalance + padding) / (range + 2 * padding)) * 100}
                    Z
                  `}
                  fill="url(#positive-gradient)"
                  className="transition-all duration-300 ease-in-out"
                />

                {/* Negative area fill */}
                <path
                  d={`
                    M ${getXPosition(0, dates.length)} ${((maxBalance + padding) / (range + 2 * padding)) * 100}
                    ${dates.map((date, i) => {
                      const x = getXPosition(i, dates.length);
                      const y = ((maxBalance + padding - Math.min(0, dailyBalances[date].balance)) / (range + 2 * padding)) * 100;
                      const zeroY = ((maxBalance + padding) / (range + 2 * padding)) * 100;
                      
                      if (i === 0) return `M ${x} ${zeroY} L ${x} ${y}`;
                      
                      return `H ${x} V ${y}`;
                    }).join(' ')}
                    H ${getXPosition(dates.length - 1, dates.length)}
                    V ${((maxBalance + padding) / (range + 2 * padding)) * 100}
                    Z
                  `}
                  fill="url(#negative-gradient)"
                  className="transition-all duration-300 ease-in-out"
                />

                {/* Line segments */}
                {dates.map((date, i) => {
                  if (i === 0) return null;
                  const prevDate = dates[i - 1];
                  const x1 = getXPosition(i - 1, dates.length);
                  const x2 = getXPosition(i, dates.length);
                  const y1 = ((maxBalance + padding - dailyBalances[prevDate].balance) / (range + 2 * padding)) * 100;
                  const y2 = ((maxBalance + padding - dailyBalances[date].balance) / (range + 2 * padding)) * 100;

                  return (
                    <g key={date}>
                      {/* Horizontal line */}
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y1}
                        stroke={dailyBalances[prevDate].balance < 0 ? '#ef4444' : '#059669'}
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* Vertical line */}
                      <line
                        x1={x2}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={dailyBalances[date].balance < 0 ? '#ef4444' : '#059669'}
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Data points - topmost layer */}
            <div className="absolute inset-0" style={{ zIndex: 4 }}>
              {dates.map((date, i) => {
                if (!dailyBalances[date].hasTransaction) return null;
                
                const x = getXPosition(i, dates.length);
                const y = ((maxBalance + padding - dailyBalances[date].balance) / (range + 2 * padding)) * 100;
                const balance = dailyBalances[date].balance;

                return (
                  <div
                    key={date}
                    className="absolute w-2.5 h-2.5 rounded-full bg-white border-2 transform -translate-x-1/2 -translate-y-1/2 
                      cursor-pointer hover:scale-150 transition-transform duration-100 group"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      borderColor: getPointColor(balance),
                      zIndex: 10
                    }}
                  >
                    {/* Tooltip */}
                    <div 
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs 
                        rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none"
                      style={{ zIndex: 20 }}
                    >
                      {new Date(date).toLocaleDateString('en-IN', { 
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}: {formatToLakhs(balance)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-axis labels */}
          <div className="absolute left-28 right-4 bottom-[-32px] flex justify-between text-xs text-gray-500">
            {dates.map((date, i) => (
              i % Math.ceil(dates.length / 8) === 0 && (
                <span 
                  key={date} 
                  className="absolute transform -translate-x-1/2 origin-top-left rotate-30 whitespace-nowrap" 
                  style={{ 
                    left: `${getXPosition(i, dates.length)}%`,
                    transformOrigin: 'left top'
                  }}
                >
                  {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 