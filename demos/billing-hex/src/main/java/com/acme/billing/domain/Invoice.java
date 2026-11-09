package com.acme.billing.domain;

public final class Invoice {
  private final InvoiceId id;
  private final Money amount;

  private Invoice(InvoiceId id, Money amount) {
    this.id = id;
    this.amount = amount;
  }

  public static Invoice open(InvoiceId id, Money amount) {
    return new Invoice(id, amount);
  }

  public InvoiceId id() {
    return id;
  }

  public Money amount() {
    return amount;
  }
}
