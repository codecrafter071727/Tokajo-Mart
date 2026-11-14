/** Conventional commits: type (feat/fix/…) + one short subject line, no body. */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-empty": [2, "always"],
    "footer-empty": [2, "always"],
    "header-max-length": [2, "always", 72],
    "subject-full-stop": [2, "never", "."],
  },
};
