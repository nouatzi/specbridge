// Component following same pattern
export class Input {
  private value: string = '';
  private placeholder: string;

  constructor(placeholder: string) {
    this.placeholder = placeholder;
  }

  setValue(value: string): void {
    this.value = value;
  }

  getValue(): string {
    return this.value;
  }

  render(): string {
    return `<input placeholder="${this.placeholder}" value="${this.value}">`;
  }
}
