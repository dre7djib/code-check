package com.acme.billing.support;

import com.google.common.base.Preconditions;

public final class PdfDocument {
  private final String title;

  public PdfDocument(String title) {
    this.title = Preconditions.checkNotNull(title);
  }

  public String title() {
    return title;
  }
}
