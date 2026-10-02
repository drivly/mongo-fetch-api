// A connection string's credentials (mongodb+srv://user:password@host) never leave this process: an
// error's text goes through here before it is logged or answered. No dependencies, so it is testable alone.
export const scrubUri = (text) => String(text ?? '').replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/?#@"'<>]+@/gi, '$1…@')
