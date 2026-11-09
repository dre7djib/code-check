package com.acme.shop.support;

public final class PlainLabel implements Label {
  private final String text;

  public PlainLabel(String text) {
    this.text = text;
  }

  @Override
  public String render() {
    return text;
  }
}
