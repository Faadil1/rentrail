declare module '@nimiq/identicons' { const Identicons: { toDataUrl(text: string): Promise<string>; svg(text: string): Promise<string> }; export default Identicons; }
