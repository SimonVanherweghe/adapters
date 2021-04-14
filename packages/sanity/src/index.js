import { createHash, randomBytes } from "crypto";

const Adapter = (config, options = {}) => {
  const { client } = config;

  async function getAdapter(appOptions) {
    // Display debug output if debug option enabled
    function _debug(...args) {
      if (appOptions.debug) {
        console.log("[next-auth][debug][sanity-adapter]", ...args);
      }
    }

    const defaultSessionMaxAge = 30 * 24 * 60 * 60 * 1000;
    const sessionMaxAge =
      appOptions && appOptions.session && appOptions.session.maxAge
        ? appOptions.session.maxAge * 1000
        : defaultSessionMaxAge;
    const sessionUpdateAge =
      appOptions && appOptions.session && appOptions.session.updateAge
        ? appOptions.session.updateAge * 1000
        : 0;

    async function createUser(profile) {
      _debug("createUser", profile);

      const {
        name = "",
        username = "",
        email = "",
        image = "",
        emailverified = "",
      } = profile;

      const user = {
        _type: "user",
        name,
        username,
        email,
        image,
        emailverified,
      };

      try {
        const newUser = await client.create(user);
        newUser.id = newUser._id;

        return newUser;
      } catch (error) {
        console.error("CREATE_USER", error);
        return Promise.reject(new Error("CREATE_USER"));
      }
    }

    async function getUser(id) {
      _debug("getUser", id);
      return null;
    }

    async function getUserByEmail(email) {
      _debug("getUserByEmail", email);
      return null;
    }

    async function getUserByProviderAccountId(providerId, providerAccountId) {
      _debug("getUserByProviderAccountId", providerId, providerAccountId);
      return null;
    }

    async function updateUser(user) {
      _debug("updateUser", user);

      const userDoc = {
        name: user.name,
        email: user.email,
        image: user.image,
        emailVerified: user.emailVerified,
        username: user.username,
      };

      try {
        const updatedUser = await client.patch(user.id).set(userDoc).commit();
        updatedUser.id = updatedUser._id;

        return updatedUser;
      } catch (error) {
        console.error("UPDATE_USER_ERROR", error);
        return Promise.reject(new Error("UPDATE_USER_ERROR"));
      }
    }

    async function deleteUser(userId) {
      _debug("deleteUser", userId);
      return null;
    }

    async function linkAccount(
      userId,
      providerId,
      providerType,
      providerAccountId,
      refreshToken,
      accessToken,
      accessTokenExpires
    ) {
      _debug(
        "linkAccount",
        userId,
        providerId,
        providerType,
        providerAccountId,
        refreshToken,
        accessToken,
        accessTokenExpires
      );

      const account = {
        _type: "account",
        userId: userId,
        providerId: providerId,
        providerType: providerType,
        providerAccountId: providerAccountId,
        refreshToken: refreshToken,
        accessToken: accessToken,
        accessTokenExpires: accessTokenExpires || "",
      };

      try {
        return await client.create(account);
      } catch (error) {
        console.error("LINK_ACCOUNT_ERROR", error);
        return Promise.reject(new Error("LINK_ACCOUNT_ERROR"));
      }
    }

    async function unlinkAccount(userId, providerId, providerAccountId) {
      _debug("unlinkAccount", userId, providerId, providerAccountId);
      return null;
    }

    async function createSession(user) {
      _debug("createSession", user);

      let expires = null;
      if (sessionMaxAge) {
        const dateExpires = new Date();
        dateExpires.setTime(dateExpires.getTime() + sessionMaxAge);
        expires = dateExpires.toISOString();
      }

      const sessionDoc = {
        _type: "session",
        userId: user.id,
        expires: expires,
        sessionToken: randomBytes(32).toString("hex"),
        accessToken: randomBytes(32).toString("hex"),
      };

      try {
        const session = await client.create(sessionDoc);
        session.id = session._id;
        session.expires = new Date(session.expires);

        return session;
      } catch (error) {
        console.error("CREATE_SESSION_ERROR", error);
        return Promise.reject(new Error("CREATE_SESSION_ERROR"));
      }

      return null;
    }

    async function getSession(sessionToken) {
      _debug("getSession", sessionToken);

      const query = '*[_type == "session" && sessionToken == $sessionToken][0]';
      const params = { sessionToken };
      try {
        const session = client.fetch(query, params);
        session.expires = new Date(session.expires);

        if (session && session.expires && new Date() > session.expires) {
          await _deleteSession(sessionToken);
          return null;
        }

        return session;
      } catch (error) {
        console.error("GET_SESSION_ERROR", error);
        return Promise.reject(new Error("GET_SESSION_ERROR"));
      }
    }

    async function updateSession(session, force) {
      _debug("updateSession", session);

      try {
        const shouldUpdate =
          sessionMaxAge &&
          (sessionUpdateAge || sessionUpdateAge === 0) &&
          session.expires;
        if (!shouldUpdate && !force) {
          return null;
        }

        // Calculate last updated date, to throttle write updates to database
        // Formula: ({expiry date} - sessionMaxAge) + sessionUpdateAge
        //     e.g. ({expiry date} - 30 days) + 1 hour
        //
        // Default for sessionMaxAge is 30 days.
        // Default for sessionUpdateAge is 1 hour.

        const dateSessionIsDueToBeUpdated = new Date(session.expires);
        dateSessionIsDueToBeUpdated.setTime(
          dateSessionIsDueToBeUpdated.getTime() - sessionMaxAge
        );
        dateSessionIsDueToBeUpdated.setTime(
          dateSessionIsDueToBeUpdated.getTime() + sessionUpdateAge
        );

        // Trigger update of session expiry date and write to database, only
        // if the session was last updated more than {sessionUpdateAge} ago
        const currentDate = new Date();
        if (currentDate < dateSessionIsDueToBeUpdated && !force) {
          return null;
        }

        const newExpiryDate = new Date();
        newExpiryDate.setTime(newExpiryDate.getTime() + sessionMaxAge);

        const sessionDoc = {
          expires: newExpiryDate,
        };

        const updatedSession = await client
          .patch(session.id)
          .set(sessionDoc)
          .commit();

        updatedSession.id = updatedSession._id;
        updatedSession.expires = new Date(updatedSession.expires);

        return updatedSession;
      } catch (error) {
        console.error("UPDATE_SESSION_ERROR", error);
        return Promise.reject(new Error("UPDATE_SESSION_ERROR"));
      }
      return null;
    }

    async function _deleteSession(sessionToken) {
      const query = '*[_type == "session" && sessionToken == $sessionToken][0]';
      const params = { sessionToken };

      const session = await client.fetch(query, params);
      const res = await client.delete(session._id);
      if (!res.results) {
        return null;
      }
      return res.results[0].document;
    }

    async function deleteSession(sessionToken) {
      _debug("deleteSession", sessionToken);
      try {
        return await _deleteSession(sessionToken);
      } catch (error) {
        console.error("DELETE_SESSION_ERROR", error);
        return Promise.reject(new Error("DELETE_SESSION_ERROR"));
      }
    }

    async function createVerificationRequest(
      identifier,
      url,
      token,
      secret,
      provider
    ) {
      _debug("createVerificationRequest", identifier);
      const { baseUrl } = appOptions?.baseUrl ?? "";
      const { sendVerificationRequest, maxAge } = provider;

      // Store hashed token (using secret as salt) so that tokens cannot be exploited
      // even if the contents of the database is compromised
      // @TODO Use bcrypt function here instead of simple salted hash
      const hashedToken = createHash("sha256")
        .update(`${token}${secret}`)
        .digest("hex");

      let expires = null;
      if (maxAge) {
        const dateExpires = new Date();
        dateExpires.setTime(dateExpires.getTime() + maxAge * 1000);

        expires = dateExpires.toISOString();
      }

      const verifDoc = {
        _type: "verificationrequest",
        identifier: identifier,
        token: hashedToken,
        expires: expires === null ? null : expires,
      };

      try {
        const verificationRequest = await client.create(verifDoc);
        verificationRequest.id = verificationRequest._id;
        verificationRequest.expires = new Date(verificationRequest.expires);

        // With the verificationCallback on a provider, you can send an email, or queue
        // an email to be sent, or perform some other action (e.g. send a text message)
        await sendVerificationRequest({
          identifier,
          url,
          token,
          baseUrl,
          provider,
        });

        return verificationRequest;
      } catch (error) {
        console.error("CREATE_VERIFICATION_REQUEST_ERROR", error);
        return Promise.reject(new Error("CREATE_VERIFICATION_REQUEST_ERROR"));
      }
    }

    const _getVerificationRequest = async (hashedToken, identifier) => {
      const query =
        '*[_type == "verificationrequest" && token== $token && identifier==$identifier][0]';
      const params = { token: hashedToken, identifier };
      return await client.fetch(query, params);
    };

    async function getVerificationRequest(identifier, token, secret, provider) {
      _debug("getVerificationRequest", identifier, token);
      const hashedToken = createHash("sha256")
        .update(`${token}${secret}`)
        .digest("hex");

      try {
        const verificationRequest = await _getVerificationRequest(
          hashedToken,
          identifier
        );
        const nowDate = Date.now();

        if (
          verificationRequest &&
          verificationRequest.expires &&
          verificationRequest.expires < nowDate
        ) {
          // Delete the expired request so it cannot be used
          await client.delete(verificationRequest._id);
          return null;
        }

        verificationRequest.id = verificationRequest._id;
        return verificationRequest;
      } catch (error) {
        console.error("GET_VERIFICATION_REQUEST_ERROR", error);
        return Promise.reject(new Error("GET_VERIFICATION_REQUEST_ERROR"));
      }
    }

    async function deleteVerificationRequest(
      identifier,
      token,
      secret,
      provider
    ) {
      _debug("deleteVerification", identifier, token);
      const hashedToken = createHash("sha256")
        .update(`${token}${secret}`)
        .digest("hex");

      try {
        const verificationRequest = await _getVerificationRequest(
          hashedToken,
          identifier
        );

        const res = await client.delete(verificationRequest._id);

        if (!res.results) {
          return null;
        }
        const doc = res.results[0].document;
        doc.id = doc._id;
        return doc;
      } catch (error) {
        console.error("DELETE_VERIFICATION_REQUEST_ERROR", error);
        return Promise.reject(new Error("DELETE_VERIFICATION_REQUEST_ERROR"));
      }
    }

    return {
      createUser,
      getUser,
      getUserByEmail,
      getUserByProviderAccountId,
      updateUser,
      deleteUser,
      linkAccount,
      unlinkAccount,
      createSession,
      getSession,
      updateSession,
      deleteSession,
      createVerificationRequest,
      getVerificationRequest,
      deleteVerificationRequest,
    };
  }

  return {
    getAdapter,
  };
};

export default { Adapter };
