export type Status = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type User = { id: string; email: string; role: 'USER' | 'ADMIN' };
export type Stock = { id: string; gameId: string; quantity: string; stock: number; price: number; isActive: boolean; discountPercent: number; finalPrice?: number; available?: boolean };
export type Game = { id: string; name: string; slug: string; description?: string | null; isActive: boolean; stocks?: Stock[] };
export type Payment = { id: number; name: string; kind: 'qris' | 'bank' | 'ewallet'; bankName: string | null; accountName: string | null; accountNumber: string | null };
export type Checkout = { adminFee: number; methods: Payment[] };
export type Tx = {
  id: string; invoiceNo: string; gameUserId: string; amount: number; adminFee: number; hasProof: boolean; expiresAt?: string | null; status: Status; paymentRef: string | null; createdAt: string;
  topupStock: Stock & { game: Game }; payment: { id: number; name: string };
  user?: { fullName: string; email: string };
  listPrice?: number | null; discountPercent?: number; paidAt?: string | null; verifiedAt?: string | null; closedAt?: string | null;
  verifierEmail?: string | null; buyer?: Buyer;
};
export type Buyer = { id: string; fullName: string; email: string; phone: string | null; instagram: string | null; address: string | null; avatarUrl: string | null };
export type Profile = { email: string; fullName: string; phone: string | null; instagram: string | null; address: string | null; role: 'USER' | 'ADMIN'; avatarUrl: string | null; nameChangeAvailableAt: string | null };
export type ChatMsg = { id: string; fromAdmin: boolean; body: string; imageUrl: string | null; transactionId: string | null; invoiceNo: string | null; createdAt: string };
export type Thread = { userId: string; fullName: string; email: string; avatarUrl: string | null; lastPreview: string; lastMessageAt: string; unread: number };
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
export type AuditLog = { id: string; action: string; entityType: string; entityId: string; statusBefore: string | null; statusAfter: string | null; createdAt: string; admin: { email: string } };

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
