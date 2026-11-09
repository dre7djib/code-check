package com.acme.shop.support;

public final class LabelFactory {
  public Label create(String text) {
    return new PlainLabel(text);
  }
}
