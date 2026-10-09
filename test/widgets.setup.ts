// vis-2 hands every widget module its base class as window.visRxWidget. The tests get a stand-in
// whose t() returns the key, plus the arguments, so assertions can name the text they expect.
class TestVisRxWidget {
    props: Record<string, unknown>;
    state: { rxData: Record<string, unknown>; values: Record<string, unknown> } = { rxData: {}, values: {} };

    constructor(props: Record<string, unknown> = {}) {
        this.props = props;
    }

    static t(key: string, ...args: string[]): string {
        return args.length ? `${key}:${args.join(',')}` : key;
    }

    static getLanguage(): string {
        return 'en';
    }

    componentDidMount(): void {}
    componentWillUnmount(): void {}
    forceUpdate(): void {}
    renderWidgetBody(): null {
        return null;
    }
    setState(value: Record<string, unknown>): void {
        Object.assign(this.state, value);
    }
    render(): null {
        return null;
    }
}

Object.defineProperty(window, 'visRxWidget', { configurable: true, value: TestVisRxWidget });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
