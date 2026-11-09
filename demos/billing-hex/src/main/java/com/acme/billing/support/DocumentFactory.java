package com.acme.billing.support;

public final class DocumentFactory {
  public PdfDocument create(String title) {
    return new PdfDocument(title);
  }
}
