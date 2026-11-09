package com.acme.billing.domain;

public final class InvoiceId {
  private final String value;

  public InvoiceId(String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("invoice id");
    }
    this.value = value;
  }

  public static InvoiceId generate() {
    return new InvoiceId("inv-" + System.nanoTime());
  }

  public String value() {
    return value;
  }
}
