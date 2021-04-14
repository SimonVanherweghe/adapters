require("dotenv").config({ path: ".env.test" });
module.exports = {
  testEnvironment: "node",
  modulePathIgnorePatterns: ["node_modules/"],
};
