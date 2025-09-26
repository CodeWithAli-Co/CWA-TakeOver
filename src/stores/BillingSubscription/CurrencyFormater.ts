export const formatCurrency = (
    amount: number,
    options?: {
      abbreviate?: boolean;
      forceAbbreviate?: boolean;
      precision?: number;
      showFull?: boolean; // New option for showing full amount
    }
  ): string => {
    if (typeof amount !== "number" || isNaN(amount)) {
      return "$0.00";
    }

    const {
      abbreviate = false,
      forceAbbreviate = false,
      precision = 1,
      showFull = false,
    } = options || {};
    const absAmount = Math.abs(amount);

    if (showFull) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    }

    // Auto-abbreviate for very large numbers or when forced
    if (forceAbbreviate || abbreviate || absAmount >= 1000000) {
      if (absAmount >= 1000000000000) {
        return `${amount < 0 ? "-" : ""}$${(absAmount / 1000000000000).toFixed(precision)}T`;
      } 
      else if (absAmount >= 1000000000) {
        return `${amount < 0 ? "-" : ""}$${(absAmount / 1000000000).toFixed(precision)}B`;
      } else if (absAmount >= 1000000) {
        return `${amount < 0 ? "-" : ""}$${(absAmount / 1000000).toFixed(precision)}M`;
      } else if (absAmount >= 1000 && (abbreviate || forceAbbreviate)) {
        return `${amount < 0 ? "-" : ""}$${(absAmount / 1000).toFixed(precision)}K`;
      }
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };