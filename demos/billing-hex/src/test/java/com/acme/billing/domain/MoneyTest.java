package com.acme.billing.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class MoneyTest {
  @Test
  void addsAmountsInTheSameCurrency() {
    Money total = new Money(100, "EUR").plus(new Money(40, "EUR"));
    assertEquals(140, total.cents());
  }

  @Test
  void rejectsADifferentCurrency() {
    assertThrows(IllegalArgumentException.class, () -> new Money(100, "EUR").plus(new Money(40, "USD")));
  }
}
