export class PlainLabel {
  constructor(readonly text: string) {
    if (text.length === 0) {
      throw new Error("label");
    }
  }
}
