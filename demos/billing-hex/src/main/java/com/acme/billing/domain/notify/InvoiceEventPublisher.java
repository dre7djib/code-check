package com.acme.billing.domain.notify;

import org.springframework.context.ApplicationEventPublisher;

public final class InvoiceEventPublisher {
  private final ApplicationEventPublisher publisher;

  public InvoiceEventPublisher(ApplicationEventPublisher publisher) {
    this.publisher = publisher;
  }

  public void published(String invoiceId) {
    publisher.publishEvent(invoiceId);
  }
}
