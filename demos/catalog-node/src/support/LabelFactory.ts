import { PlainLabel } from "./PlainLabel";

export class LabelFactory {
  create(text: string): PlainLabel {
    return new PlainLabel(text);
  }
}
