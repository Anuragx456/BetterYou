export class ProductNotFoundError extends Error {
  readonly barcode: string;
  constructor(barcode: string) {
    super(`Product with barcode "${barcode}" was not found in OpenFoodFacts or OpenBeautyFacts databases.`);
    this.name = 'ProductNotFoundError';
    this.barcode = barcode;
  }
}

export interface OpenFactsProductResponse {
  status: number;
  product?: {
    product_name?: string;
    product_name_en?: string;
    product_name_hi?: string;
    ingredients_text?: string;
    ingredients_text_en?: string;
    additives_tags?: string[];
    nova_group?: number;
    nutriscore_grade?: string;
  };
}
