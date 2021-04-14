import Adapter from "../src";

import sanityClient from "@sanity/client";

const client = sanityClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  apiVersion: "2021-04-13", // use current UTC date - see "specifying API version"!
  token: process.env.SANITY_API_DEVELOPMENT_TOKEN, // or leave blank for unauthenticated usage
  useCdn: false, // `false` if you want to ensure fresh data
});

let session = null;
let user = null;
let verificationRequest = null;

const docsToDelete = [];

const SECRET = "secret";
const TOKEN = "token";

describe("adapter functions", () => {
  beforeAll(() => {});

  afterAll(async () => {
    Promise.all(docsToDelete.map((id) => client.delete(id)));
  });
  // User

  test("createUser", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    user = await adapter.createUser({
      email: "test@next-auth.com",
      name: "test",
      image: "https://",
    });

    expect(user.id).not.toBeNull();
    expect(user.email).toMatchInlineSnapshot(`"test@next-auth.com"`);
    expect(user.name).toMatchInlineSnapshot(`"test"`);
    expect(user.image).toMatchInlineSnapshot(`"https://"`);

    docsToDelete.push(user.id);
  });
  test("updateUser", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!user) throw new Error("No User Available");

    user = await adapter.updateUser({
      id: user.id,
      name: "Changed",
    });
    expect(user.name).toEqual("Changed");
  });

  // Sessions
  test("createSession", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!user) throw new Error("No User Available");

    session = await adapter.createSession({
      id: user.id,
    });

    expect(session.sessionToken.length).toMatchInlineSnapshot(`64`);
    expect(session.accessToken.length).toMatchInlineSnapshot(`64`);
    expect(session.userId).toEqual(user.id);

    docsToDelete.push(session.id);
  });
  test("getSession", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!session) throw new Error("No Session Available");

    const result = await adapter.getSession(session.sessionToken);

    expect(result.sessionToken).toEqual(session.sessionToken);
    expect(result.accessToken).toEqual(session.accessToken);
    expect(result.userId).toEqual(user.id);
  });
  test("updateSession", async () => {
    const maxAge = 30 * 24 * 60 * 60;
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!session) throw new Error("No Session Available");

    const expires = new Date(2070, 1);
    const expiresExpected = Date.now() + maxAge * 1000;
    session = await adapter.updateSession(
      {
        expires: expires,
        id: session.id,
        sessionToken: session.sessionToken,
      },
      true
    );

    const difference = Math.abs(session.expires.getTime() - expiresExpected);
    expect(difference).toBeLessThan(5);
  });
  test("deleteSession", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!session) throw new Error("No Session Available");
    const result = await adapter.deleteSession(session.sessionToken);
    expect(result.sessionToken).toEqual(session.sessionToken);
  });

  test("createVerificationRequest", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    verificationRequest = await adapter.createVerificationRequest(
      "any",
      "https://some.where",
      TOKEN,
      SECRET,
      {
        maxAge: 90,
        sendVerificationRequest: async (request) => {},
      }
    );
    expect(verificationRequest.id).not.toBeNull();
    expect(verificationRequest.identifier).toEqual("any");

    docsToDelete.push(verificationRequest.id);
  });

  test("getVerificationRequest", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!verificationRequest)
      throw new Error("No Verification Request Available");

    const result = await adapter.getVerificationRequest(
      verificationRequest.identifier,
      TOKEN,
      SECRET,
      "provider"
    );
    expect(result?.token).toEqual(verificationRequest.token);
  });
  test("deleteVerificationRequest", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!verificationRequest)
      throw new Error("No Verification Request Available");
    const result = await adapter.deleteVerificationRequest(
      verificationRequest.identifier,
      TOKEN,
      SECRET,
      "provider"
    );
    expect(result.id).toEqual(verificationRequest.id);
  });
});
