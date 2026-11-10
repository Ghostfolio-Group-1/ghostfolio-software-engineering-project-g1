import JSDOMEnvironment from 'jest-environment-jsdom';

// jsdom has no fetch. The harness talks to a real API, so expose Node's
// built-in fetch (and its Headers / Response) inside the jsdom test window.
export default class JSDOMWithFetchEnvironment extends JSDOMEnvironment {
  public override async setup() {
    await super.setup();

    this.global.fetch = fetch;
    this.global.Headers = Headers;
    this.global.Request = Request;
    this.global.Response = Response;
  }
}
