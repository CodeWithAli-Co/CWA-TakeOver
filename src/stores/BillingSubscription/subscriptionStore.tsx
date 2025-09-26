import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SubscriptionPlan = 'free' | 'basic' | 'premium';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

interface SubscriptionFeatures {
  manualExpenseTracking: boolean;
  plaidIntegration: boolean;
  maxBankAccounts: number | 'unlimited';
  automaticTransactionImport: boolean;
  advancedAnalytics: boolean;
  cloudBackup: boolean;
  investmentTracking: boolean;
  prioritySupport: boolean;
  customGoals: boolean;
  advancedReporting: boolean;
}

interface SubscriptionState {
  // Current subscription info
  currentPlan: SubscriptionPlan | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionId: string | null;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  
  // Feature access
  features: SubscriptionFeatures;
  
  // UI state
  hasCompletedOnboarding: boolean;
  showPlansModal: boolean;
  
  // Actions
  setSubscriptionPlan: (plan: SubscriptionPlan) => void;
  setSubscriptionStatus: (status: SubscriptionStatus) => void;
  updateFeatures: (plan: SubscriptionPlan) => void;
  completeOnboarding: () => void;
  setShowPlansModal: (show: boolean) => void;
  resetSubscription: () => void;
  
  // Getters
  hasFeature: (feature: keyof SubscriptionFeatures) => boolean;
  canConnectMoreBanks: (currentBankCount: number) => boolean;
  getPlanDisplayName: () => string;
  getPlanPrice: () => string;
}

const getDefaultFeatures = (plan: SubscriptionPlan): SubscriptionFeatures => {
  const baseFeatures: SubscriptionFeatures = {
    manualExpenseTracking: true,
    plaidIntegration: false,
    maxBankAccounts: 0,
    automaticTransactionImport: false,
    advancedAnalytics: false,
    cloudBackup: false,
    investmentTracking: false,
    prioritySupport: false,
    customGoals: false,
    advancedReporting: false,
  };

  switch (plan) {
    case 'free':
      return baseFeatures;
    
    case 'basic':
      return {
        ...baseFeatures,
        plaidIntegration: true,
        maxBankAccounts: 2,
        automaticTransactionImport: true,
      };
    
    case 'premium':
      return {
        ...baseFeatures,
        plaidIntegration: true,
        maxBankAccounts: 'unlimited',
        automaticTransactionImport: true,
        advancedAnalytics: true,
        cloudBackup: true,
        investmentTracking: true,
        prioritySupport: true,
        customGoals: true,
        advancedReporting: true,
      };
    
    default:
      return baseFeatures;
  }
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentPlan: null,
      subscriptionStatus: null,
      subscriptionId: null,
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      features: getDefaultFeatures('free'),
      hasCompletedOnboarding: false,
      showPlansModal: false,

      // Actions
      setSubscriptionPlan: (plan: SubscriptionPlan) => {
        const features = getDefaultFeatures(plan);
        const now = new Date();
        
        set({
          currentPlan: plan,
          features,
          subscriptionStatus: 'active',
          subscriptionStartDate: now,
          subscriptionEndDate: plan === 'free' ? null : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now for paid plans
          hasCompletedOnboarding: true,
        });
      },

      setSubscriptionStatus: (status: SubscriptionStatus) => {
        set({ subscriptionStatus: status });
      },

      updateFeatures: (plan: SubscriptionPlan) => {
        const features = getDefaultFeatures(plan);
        set({ features });
      },

      completeOnboarding: () => {
        set({ hasCompletedOnboarding: true });
      },

      setShowPlansModal: (show: boolean) => {
        set({ showPlansModal: show });
      },

      resetSubscription: () => {
        set({
          currentPlan: null,
          subscriptionStatus: null,
          subscriptionId: null,
          subscriptionStartDate: null,
          subscriptionEndDate: null,
          features: getDefaultFeatures('free'),
          hasCompletedOnboarding: false,
          showPlansModal: false,
        });
      },

      // Getters
      hasFeature: (feature: keyof SubscriptionFeatures) => {
        const state = get();
        return Boolean(state.features[feature]);
      },

      canConnectMoreBanks: (currentBankCount: number) => {
        const state = get();
        const maxAccounts = state.features.maxBankAccounts;
        
        if (maxAccounts === 'unlimited') return true;
        if (typeof maxAccounts === 'number') return currentBankCount < maxAccounts;
        return false;
      },

      getPlanDisplayName: () => {
        const state = get();
        if (!state.currentPlan) return 'No Plan';
        
        return state.currentPlan.charAt(0).toUpperCase() + state.currentPlan.slice(1);
      },

      getPlanPrice: () => {
        const state = get();
        if (!state.currentPlan) return '$0';
        
        switch (state.currentPlan) {
          case 'free':
            return '$0';
          case 'basic':
            return '$9.99/month';
          case 'premium':
            return '$24.99/month';
          default:
            return '$0';
        }
      },
    }),
    {
      name: 'subscription-store',
      // Only persist certain fields
      partialize: (state) => ({
        currentPlan: state.currentPlan,
        subscriptionStatus: state.subscriptionStatus,
        subscriptionId: state.subscriptionId,
        subscriptionStartDate: state.subscriptionStartDate,
        subscriptionEndDate: state.subscriptionEndDate,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);

// Helper hooks for common use cases
export const useCurrentPlan = () => {
  return useSubscriptionStore((state) => state.currentPlan);
};

export const useSubscriptionFeatures = () => {
  return useSubscriptionStore((state) => state.features);
};

export const useHasCompletedOnboarding = () => {
  return useSubscriptionStore((state) => state.hasCompletedOnboarding);
};

export const useCanConnectBanks = () => {
  const features = useSubscriptionStore((state) => state.features);
  return features.plaidIntegration;
};

export const useMaxBankAccounts = () => {
  const features = useSubscriptionStore((state) => state.features);
  return features.maxBankAccounts;
};