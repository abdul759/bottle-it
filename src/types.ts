export type MaterialType = 'Plastic' | 'Glass' | 'Aluminum' | 'Paper' | 'Other';

export interface Product {
  barcode: string;
  name: string;
  brand: string;
  type: MaterialType;
  accepted: boolean;
  value: number;
  instructions: string;
}

export interface ScanHistory {
  id: string;
  product: Product;
  timestamp: number;
}
