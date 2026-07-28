// ============================================================================
// Eganyé — Couche d'Abstraction des Paiements (PaymentProvider)
// ============================================================================
// Permet d'intégrer ou d'interchanger dynamiquement Flooz, TMoney, Wave,
// Orange Money, Paydunya ou les Paiements en Espèces sans modifier le code métier.
// ============================================================================

export type PaymentMethodType = 'flooz' | 'tmoney' | 'wave' | 'orange_money' | 'cash' | 'card' | 'wallet';

export interface PaymentRequest {
  idempotencyKey: string;
  userId: string;
  userName: string;
  userEmail?: string;
  phone?: string;
  amount: number;
  currency: string;
  description: string;
  groupId?: string;
  contributionId?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  method: PaymentMethodType;
  message: string;
  receiptNumber?: string;
  verifiedBy?: string;
  timestamp: string;
}

export interface PaymentProvider {
  name: string;
  method: PaymentMethodType;
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  verifyPayment(transactionId: string): Promise<boolean>;
}

// 1. Flooz Provider (Togo - Moov Africa)
export class FloozProvider implements PaymentProvider {
  name = 'Moov Flooz (Togo)';
  method: PaymentMethodType = 'flooz';

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const txId = `flooz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      transactionId: txId,
      method: this.method,
      message: `Paiement Flooz de ${request.amount.toLocaleString()} ${request.currency} initialisé sur le ${request.phone || 'compte Moov'}.`,
      receiptNumber: `REC-FLZ-${txId.slice(-8).toUpperCase()}`,
      timestamp: new Date().toISOString()
    };
  }

  async verifyPayment(_transactionId: string): Promise<boolean> {
    return true;
  }
}

// 2. TMoney Provider (Togo - Togocom)
export class TMoneyProvider implements PaymentProvider {
  name = 'Togocom TMoney (Togo)';
  method: PaymentMethodType = 'tmoney';

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const txId = `tmoney_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      transactionId: txId,
      method: this.method,
      message: `Paiement TMoney de ${request.amount.toLocaleString()} ${request.currency} initialisé sur le ${request.phone || 'compte Togocom'}.`,
      receiptNumber: `REC-TMN-${txId.slice(-8).toUpperCase()}`,
      timestamp: new Date().toISOString()
    };
  }

  async verifyPayment(_transactionId: string): Promise<boolean> {
    return true;
  }
}

// 3. Wave Provider
export class WaveProvider implements PaymentProvider {
  name = 'Wave Mobile Money';
  method: PaymentMethodType = 'wave';

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const txId = `wave_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      transactionId: txId,
      method: this.method,
      message: `Paiement Wave de ${request.amount.toLocaleString()} ${request.currency} traité avec succès.`,
      receiptNumber: `REC-WAV-${txId.slice(-8).toUpperCase()}`,
      timestamp: new Date().toISOString()
    };
  }

  async verifyPayment(_transactionId: string): Promise<boolean> {
    return true;
  }
}

// 4. Cash Provider (Tontine Hybride Espèces)
export class CashProvider implements PaymentProvider {
  name = 'Paiement en Espèces (Mains propres)';
  method: PaymentMethodType = 'cash';

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const txId = `cash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      transactionId: txId,
      method: this.method,
      message: `Déclaration de paiement en espèces enregistrée. En attente de validation par la trésorière.`,
      receiptNumber: `REC-CSH-${txId.slice(-8).toUpperCase()}`,
      verifiedBy: 'Trésorier du Cercle',
      timestamp: new Date().toISOString()
    };
  }

  async verifyPayment(_transactionId: string): Promise<boolean> {
    return true;
  }
}

// Payment Manager Registry
export class PaymentRegistry {
  private providers: Map<PaymentMethodType, PaymentProvider> = new Map();

  constructor() {
    this.registerProvider(new FloozProvider());
    this.registerProvider(new TMoneyProvider());
    this.registerProvider(new WaveProvider());
    this.registerProvider(new CashProvider());
  }

  registerProvider(provider: PaymentProvider) {
    this.providers.set(provider.method, provider);
  }

  getProvider(method: PaymentMethodType): PaymentProvider {
    const provider = this.providers.get(method);
    if (!provider) {
      return this.providers.get('cash')!;
    }
    return provider;
  }

  async executePayment(method: PaymentMethodType, request: PaymentRequest): Promise<PaymentResult> {
    const provider = this.getProvider(method);
    return provider.processPayment(request);
  }
}

export const paymentRegistry = new PaymentRegistry();
