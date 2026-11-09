package com.acme.billing.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentServiceTransactional {
  @Transactional
  public void record(String paymentId) {
    if (paymentId == null || paymentId.isBlank()) {
      throw new IllegalArgumentException("paymentId");
    }
  }
}
