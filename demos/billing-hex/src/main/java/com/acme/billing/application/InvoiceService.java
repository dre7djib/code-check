package com.acme.billing.application;

import com.acme.billing.domain.Invoice;
import com.acme.billing.domain.InvoiceId;
import com.acme.billing.domain.Money;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoiceService {
  private final IssueInvoice issueInvoice;

  public InvoiceService(IssueInvoice issueInvoice) {
    this.issueInvoice = issueInvoice;
  }

  @Transactional
  public Invoice settle(InvoiceId id, Money amount) {
    return issueInvoice.issue(id, amount);
  }
}
