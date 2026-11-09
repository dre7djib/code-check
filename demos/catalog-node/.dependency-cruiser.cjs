/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-free-of-frameworks",
      severity: "error",
      comment: "Le domaine n'importe ni Express ni les autres couches.",
      from: { path: "^src/domain" },
      to: { path: "(^src/(application|adapters)|node_modules/express)" },
    },
    {
      name: "application-does-not-import-adapters",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "^src/adapters" },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: "node_modules" },
  },
};
