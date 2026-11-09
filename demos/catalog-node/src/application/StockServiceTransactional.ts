function Transactional<T extends (...args: never[]) => unknown>(method: T, _context: ClassMethodDecoratorContext): T {
  return method;
}

export class StockServiceTransactional {
  @Transactional
  reserve(sku: string, quantity: number): void {
    if (sku.length === 0 || quantity <= 0) {
      throw new Error("reservation");
    }
  }
}
