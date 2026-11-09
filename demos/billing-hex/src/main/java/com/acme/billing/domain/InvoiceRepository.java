package com.acme.billing.domain;

public interface InvoiceRepository {
  Invoice find(InvoiceId id);

  void save(Invoice invoice);
}
