package com.acme.billing.domain;

public final class Money {
  private final long cents;
  private final String currency;

  public Money(long cents, String currency) {
    if (currency == null || currency.length() != 3) {
      throw new IllegalArgumentException("currency");
    }
    this.cents = cents;
    this.currency = currency;
  }

  public Money plus(Money other) {
    if (!currency.equals(other.currency)) {
      throw new IllegalArgumentException("currency mismatch");
    }
    return new Money(cents + other.cents, currency);
  }

  public long cents() {
    return cents;
  }

  public String currency() {
    return currency;
  }
}
