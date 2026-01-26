// Sample component with naming pattern
export class Button {
  private label: string;
  private onClick: () => void;

  constructor(label: string, onClick: () => void) {
    this.label = label;
    this.onClick = onClick;
  }

  render(): string {
    return `<button>${this.label}</button>`;
  }

  handleClick(): void {
    this.onClick();
  }
}
