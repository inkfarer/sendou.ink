import path from "path";
import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";
import { setUpAuth } from "./auth";
import { seed } from "../prisma/seed/script";

const MODE = process.env.NODE_ENV;
const BUILD_DIR = path.join(process.cwd(), "server/build");

const app = express();
app.use(compression());

// You may want to be more aggressive with this caching
app.use(express.static("public", { maxAge: "1h" }));

// Remix fingerprints its assets so we can cache forever
app.use(express.static("public/build", { immutable: true, maxAge: "1y" }));

app.use(morgan("tiny"));

try {
  setUpAuth(app);
} catch (err) {
  console.error(err);
}

function userToContext(req: Express.Request) {
  if (process.env.NODE_ENV === "development") {
    // @ts-expect-error
    const mockedUser = req.headers["mock-auth"];
    if (mockedUser) {
      return { user: JSON.parse(mockedUser) };
    }
  }
  return { user: req.user };
}

if (process.env.NODE_ENV === "development") {
  app.post("/seed", async (_req, res) => {
    await seed();

    res.status(200).end();
  });
}

app.all(
  "*",
  MODE === "production"
    ? createRequestHandler({
        build: require("./build"),
        getLoadContext: userToContext,
      })
    : (req, res, next) => {
        purgeRequireCache();
        const build = require("./build");
        return createRequestHandler({
          build,
          mode: MODE,
          getLoadContext: userToContext,
        })(req, res, next);
      }
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});

////////////////////////////////////////////////////////////////////////////////
function purgeRequireCache() {
  // purge require cache on requests for "server side HMR" this won't let
  // you have in-memory objects between requests in development,
  // alternatively you can set up nodemon/pm2-dev to restart the server on
  // file changes, we prefer the DX of this though, so we've included it
  // for you by default
  for (const key in require.cache) {
    if (key.startsWith(BUILD_DIR)) {
      delete require.cache[key];
    }
  }
}