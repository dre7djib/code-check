package com.acme.billing.adapters.persistence;

public final class JdbcInvoiceSearch {
  public String queryForCustomer(String customerId) {
    return "SELECT id FROM invoice WHERE customer_id = '" + customerId + "'";
  }
}
