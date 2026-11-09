package com.acme.billing.domain;

public final class LateFeePolicy {
  public Money feeFor(int daysLate, Money principal) {
    if (daysLate <= 0) {
      return new Money(0, principal.currency());
    }
    long fee = principal.cents() * daysLate / 100;
    return new Money(Math.min(fee, principal.cents()), principal.currency());
  }
}
