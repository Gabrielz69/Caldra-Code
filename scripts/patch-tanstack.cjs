const fs = require("fs");
const path = require("path");

function patchFile(filePath, transforms) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;

  for (const { from, to } of transforms) {
    if (typeof from === "string") {
      if (content.includes(from)) {
        content = content.replaceAll(from, to);
        modified = true;
      }
    } else if (from instanceof RegExp) {
      if (from.test(content)) {
        content = content.replace(from, to);
        modified = true;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`Successfully patched: ${filePath}`);
  }
  return modified;
}

const transforms = [
  // 1. preBeforeLoadSetup check
  {
    from: "if (!existingMatch._nonReactive.beforeLoadPromise && !existingMatch._nonReactive.loaderPromise) return;",
    to: "if (!existingMatch || (!existingMatch._nonReactive?.beforeLoadPromise && !existingMatch._nonReactive?.loaderPromise)) return;",
  },
  {
    from: "return existingMatch._nonReactive.beforeLoadPromise ? existingMatch._nonReactive.beforeLoadPromise.then(then) : then();",
    to: "return existingMatch?._nonReactive?.beforeLoadPromise ? existingMatch._nonReactive.beforeLoadPromise.then(then) : then();",
  },
  // 2. setupPendingTimeout guard
  {
    from: "if (match._nonReactive.pendingTimeout !== void 0) return;",
    to: "if (!match?._nonReactive || match._nonReactive.pendingTimeout !== void 0) return;",
  },
  {
    from: "match._nonReactive.pendingTimeout = pendingTimeout;",
    to: "if (match?._nonReactive) match._nonReactive.pendingTimeout = pendingTimeout;",
  },
  // 3. executeBeforeLoad match fallback
  {
    from: "const match = inner.router.getMatch(matchId);\n\tlet prevLoadPromise = match._nonReactive.loadPromise;",
    to: "const match = inner.router.getMatch(matchId) ?? inner.matches[index];\n\tlet prevLoadPromise = match?._nonReactive?.loadPromise;",
  },
  {
    from: "const match = inner.router.getMatch(matchId);\r\n\tlet prevLoadPromise = match._nonReactive.loadPromise;",
    to: "const match = inner.router.getMatch(matchId) ?? inner.matches[index];\r\n\tlet prevLoadPromise = match?._nonReactive?.loadPromise;",
  },
  {
    from: "match._nonReactive.loadPromise = createControlledPromise(() => {",
    to: "if (match?._nonReactive) match._nonReactive.loadPromise = createControlledPromise(() => {",
  },
  {
    from: "match._nonReactive.loadPromise = require_utils.createControlledPromise(() => {",
    to: "if (match?._nonReactive) match._nonReactive.loadPromise = require_utils.createControlledPromise(() => {",
  },
  {
    from: "match._nonReactive.beforeLoadPromise?.resolve();\n\t\tmatch._nonReactive.beforeLoadPromise = void 0;",
    to: "match?._nonReactive?.beforeLoadPromise?.resolve();\n\t\tif (match?._nonReactive) match._nonReactive.beforeLoadPromise = void 0;",
  },
  {
    from: "match._nonReactive.beforeLoadPromise?.resolve();\r\n\t\tmatch._nonReactive.beforeLoadPromise = void 0;",
    to: "match?._nonReactive?.beforeLoadPromise?.resolve();\r\n\t\tif (match?._nonReactive) match._nonReactive.beforeLoadPromise = void 0;",
  },
  {
    from: "match._nonReactive.beforeLoadPromise = createControlledPromise();",
    to: "if (match?._nonReactive) match._nonReactive.beforeLoadPromise = createControlledPromise();",
  },
  {
    from: "match._nonReactive.beforeLoadPromise = require_utils.createControlledPromise();",
    to: "if (match?._nonReactive) match._nonReactive.beforeLoadPromise = require_utils.createControlledPromise();",
  },
  // 4. loadRouteMatch prevMatch checks
  {
    from: "if (prevMatch._nonReactive.loaderPromise) {",
    to: "if (prevMatch?._nonReactive?.loaderPromise) {",
  },
  {
    from: "const match = inner.router.getMatch(matchId);\n\t\t\tconst error = match._nonReactive.error || match.error;",
    to: "const match = inner.router.getMatch(matchId) ?? inner.matches[index];\n\t\t\tconst error = match?._nonReactive?.error || match?.error;",
  },
  {
    from: "const match = inner.router.getMatch(matchId);\r\n\t\t\tconst error = match._nonReactive.error || match.error;",
    to: "const match = inner.router.getMatch(matchId) ?? inner.matches[index];\r\n\t\t\tconst error = match?._nonReactive?.error || match?.error;",
  },
  {
    from: "const match = inner.router.getMatch(matchId);\n\t\t\tmatch._nonReactive.loaderPromise = createControlledPromise();",
    to: "const match = inner.router.getMatch(matchId) ?? inner.matches[index];\n\t\t\tif (match?._nonReactive) match._nonReactive.loaderPromise = createControlledPromise();",
  },
  {
    from: "const match = inner.router.getMatch(matchId);\r\n\t\t\tmatch._nonReactive.loaderPromise = require_utils.createControlledPromise();",
    to: "const match = inner.router.getMatch(matchId) ?? inner.matches[index];\r\n\t\t\tif (match?._nonReactive) match._nonReactive.loaderPromise = require_utils.createControlledPromise();",
  },
  {
    from: "const match = inner.router.getMatch(matchId);\n\tif (!loaderIsRunningAsync) {\n\t\tmatch._nonReactive.loaderPromise?.resolve();\n\t\tmatch._nonReactive.loadPromise?.resolve();\n\t\tmatch._nonReactive.loadPromise = void 0;\n\t}\n\tclearTimeout(match._nonReactive.pendingTimeout);\n\tmatch._nonReactive.pendingTimeout = void 0;\n\tif (!loaderIsRunningAsync) match._nonReactive.loaderPromise = void 0;\n\tmatch._nonReactive.dehydrated = void 0;",
    to: `const match = inner.router.getMatch(matchId) ?? inner.matches[index];
\tif (!loaderIsRunningAsync && match?._nonReactive) {
\t\tmatch._nonReactive.loaderPromise?.resolve();
\t\tmatch._nonReactive.loadPromise?.resolve();
\t\tmatch._nonReactive.loadPromise = void 0;
\t}
\tif (match?._nonReactive) {
\t\tclearTimeout(match._nonReactive.pendingTimeout);
\t\tmatch._nonReactive.pendingTimeout = void 0;
\t\tif (!loaderIsRunningAsync) match._nonReactive.loaderPromise = void 0;
\t\tmatch._nonReactive.dehydrated = void 0;
\t}`,
  },
  // 5. updateMatch error cleanup
  {
    from: "prev._nonReactive.beforeLoadPromise?.resolve();\n\t\tprev._nonReactive.beforeLoadPromise = void 0;\n\t\tprev._nonReactive.loadPromise?.resolve();",
    to: "if (prev?._nonReactive) {\n\t\t\tprev._nonReactive.beforeLoadPromise?.resolve();\n\t\t\tprev._nonReactive.beforeLoadPromise = void 0;\n\t\t\tprev._nonReactive.loadPromise?.resolve();\n\t\t}",
  },
  {
    from: "prev._nonReactive.beforeLoadPromise?.resolve();\r\n\t\tprev._nonReactive.beforeLoadPromise = void 0;\r\n\t\tprev._nonReactive.loadPromise?.resolve();",
    to: "if (prev?._nonReactive) {\r\n\t\t\tprev._nonReactive.beforeLoadPromise?.resolve();\r\n\t\t\tprev._nonReactive.beforeLoadPromise = void 0;\r\n\t\t\tprev._nonReactive.loadPromise?.resolve();\r\n\t\t}",
  },
  // 6. ssr-client updateMatch
  {
    from: "prev._nonReactive.minPendingPromise = void 0;",
    to: "if (prev?._nonReactive) prev._nonReactive.minPendingPromise = void 0;",
  },
  {
    from: "match._nonReactive.dehydrated = void 0;",
    to: "if (match?._nonReactive) match._nonReactive.dehydrated = void 0;",
  },
  {
    from: "match._nonReactive.displayPendingPromise = loadPromise;",
    to: "if (match?._nonReactive) match._nonReactive.displayPendingPromise = loadPromise;",
  },
];

const targetFiles = [
  path.join(__dirname, "../node_modules/@tanstack/router-core/dist/esm/load-matches.js"),
  path.join(__dirname, "../node_modules/@tanstack/router-core/dist/cjs/load-matches.cjs"),
  path.join(__dirname, "../node_modules/@tanstack/router-core/dist/esm/ssr/ssr-client.js"),
  path.join(__dirname, "../node_modules/@tanstack/router-core/dist/cjs/ssr/ssr-client.cjs"),
];

let anyModified = false;
for (const f of targetFiles) {
  if (patchFile(f, transforms)) {
    anyModified = true;
  }
}

// Remove vite prebundle cache only if files were newly patched so vite re-bundles @tanstack/router-core
if (anyModified) {
  const viteCache = path.join(__dirname, "../node_modules/.vite");
  if (fs.existsSync(viteCache)) {
    try {
      fs.rmSync(viteCache, { recursive: true, force: true });
      console.log("Cleared node_modules/.vite cache");
    } catch (err) {
      console.warn("Could not clear .vite cache:", err.message);
    }
  }
}

// Copy occt-wasm.wasm to public/ if missing or out of date
const occtWasmSrc = path.join(__dirname, "../node_modules/occt-wasm/dist/occt-wasm.wasm");
const occtWasmDest = path.join(__dirname, "../public/occt-wasm.wasm");
if (fs.existsSync(occtWasmSrc)) {
  try {
    if (!fs.existsSync(occtWasmDest) || fs.statSync(occtWasmSrc).size !== fs.statSync(occtWasmDest).size) {
      fs.copyFileSync(occtWasmSrc, occtWasmDest);
      console.log("Copied occt-wasm.wasm to public/");
    }
  } catch (err) {
    console.warn("Could not copy occt-wasm.wasm:", err.message);
  }
}

