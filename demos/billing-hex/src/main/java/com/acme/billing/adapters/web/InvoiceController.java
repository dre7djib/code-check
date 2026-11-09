package com.acme.billing.adapters.web;

import com.acme.billing.application.IssueInvoice;
import com.acme.billing.domain.InvoiceId;
import com.acme.billing.domain.Money;

public final class InvoiceController {
  private final IssueInvoice issueInvoice;

  public InvoiceController(IssueInvoice issueInvoice) {
    this.issueInvoice = issueInvoice;
  }

  public String create(String rawAmount) {
    try {
      long cents = Long.parseLong(rawAmount);
      issueInvoice.issue(InvoiceId.generate(), new Money(cents, "EUR"));
      return "created";
    } catch (RuntimeException ignored) {
    }
    return "error";
  }
}
