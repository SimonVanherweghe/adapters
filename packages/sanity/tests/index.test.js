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
let account = null;

const SECRET = "secret";
const TOKEN = "token";

const PROVIDERACCOUNTID = "providerAccountId";
const PROVIDERID = "providerId";

describe("adapter functions", () => {
  beforeAll(async () => {});

  afterAll(async () => {
    query = '*[_type == "account"]';
    await client.delete({ query });

    let query = '*[_type == "user"]';
    await client.delete({ query });

    query = '*[_type == "session"]';
    await client.delete({ query });

    query = '*[_type == "verificationrequest"]';
    await client.delete({ query });
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
  });

  test("createUser without email", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    const user2 = await adapter.createUser({
      name: "No Mail",
      image: "https://",
    });

    expect(user2.id).not.toBeNull();
    expect(user2.email).toBeUndefined();
    expect(user2.emailVerified).toBeUndefined();
    expect(user2.name).toMatchInlineSnapshot(`"No Mail"`);
    expect(user2.image).toMatchInlineSnapshot(`"https://"`);
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

  test("getUser", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!user) throw new Error("No User Available");

    const expUser = await adapter.getUser(user.id);
    expect(user.id).toBe(expUser.id);
  });

  test("getUserByEmail", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!user) throw new Error("No User Available");

    const expUser = await adapter.getUserByEmail("test@next-auth.com");
    expect(user.id).toBe(expUser.id);
  });

  test("linkAccount", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!user) throw new Error("No User Available");

    account = await adapter.linkAccount(
      user.id,
      PROVIDERID,
      "2",
      PROVIDERACCOUNTID,
      "refresh",
      "access",
      new Date()
    );
    expect(account.userId).toBe(user.id);
    expect(account.providerId).toBe(PROVIDERID);
    expect(account.providerType).toBe("2");
    expect(account.providerAccountId).toBe(PROVIDERACCOUNTID);
    expect(account.refreshToken).toBe("refresh");
    expect(account.accessToken).toBe("access");
  });

  test("getUserByProvider", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    const expUser = await adapter.getUserByProviderAccountId(
      PROVIDERID,
      PROVIDERACCOUNTID
    );
    expect(expUser.id).toEqual(user.id);
  });

  test("getUserByProvider without match should return null", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    const expUser = await adapter.getUserByProviderAccountId("foo", "bar");
    expect(expUser).toBeNull();
  });

  test("unlink account", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!account) throw new Error("No User Available");

    const result = await adapter.unlinkAccount(
      account.userId,
      account.providerId,
      account.providerAccountId
    );
    expect(result.accessTokenExpires).toEqual(account.accessTokenExpires);
  });

  // Sessions
  test("createSession", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!user) throw new Error("No User Available");

    session = await adapter.createSession(user);

    expect(session.sessionToken.length).toMatchInlineSnapshot(`64`);
    expect(session.accessToken.length).toMatchInlineSnapshot(`64`);
    expect(session.user).not.toBeNull();
  });

  test("getSession", async () => {
    const adapter = await Adapter.Adapter({ client }).getAdapter({
      appOptions: {},
    });
    if (!session) throw new Error("No Session Available");

    const result = await adapter.getSession(session.sessionToken);

    expect(result.sessionToken).toEqual(session.sessionToken);
    expect(result.accessToken).toEqual(session.accessToken);
    expect(result.user.id).toEqual(user.id);
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
