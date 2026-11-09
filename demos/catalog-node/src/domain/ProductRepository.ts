import type { Product } from "./Product";

export interface ProductRepository {
  find(id: string): Product | undefined;
  save(product: Product): void;
}
