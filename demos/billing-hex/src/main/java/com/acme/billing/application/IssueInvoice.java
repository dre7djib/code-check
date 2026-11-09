package com.acme.billing.application;

import com.acme.billing.domain.Invoice;
import com.acme.billing.domain.InvoiceId;
import com.acme.billing.domain.InvoiceRepository;
import com.acme.billing.domain.Money;

public final class IssueInvoice {
  private final InvoiceRepository invoices;

  public IssueInvoice(InvoiceRepository invoices) {
    this.invoices = invoices;
  }

  public Invoice issue(InvoiceId id, Money amount) {
    Invoice invoice = Invoice.open(id, amount);
    invoices.save(invoice);
    return invoice;
  }
}
