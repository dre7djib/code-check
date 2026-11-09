import { Product } from "../domain/Product";
import { PublishProduct } from "./PublishProduct";

function Transactional<T extends (...args: never[]) => unknown>(method: T, _context: ClassMethodDecoratorContext): T {
  return method;
}

export class ProductService {
  constructor(private readonly publishProduct: PublishProduct) {}

  @Transactional
  publish(product: Product): Product {
    return this.publishProduct.publish(product);
  }
}
