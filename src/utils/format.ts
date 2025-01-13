export const formatToLakhs = (amount: number, showDecimals: boolean = true): string => {
  const absAmount = Math.abs(amount);
  if (absAmount >= 100000) {
    return `₹${showDecimals ? (amount / 100000).toFixed(2) : Math.round(amount / 100000)}L`;
  } else if (absAmount >= 1000) {
    return `₹${showDecimals ? (amount / 1000).toFixed(2) : Math.round(amount / 1000)}K`;
  } else {
    return `₹${showDecimals ? amount.toFixed(2) : Math.round(amount)}`;
  }
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}; 