// Import Oak and HTTPS modules
import { Application } from "https://deno.land/x/oak@v17.1.4/mod.ts";

// Define paths for SSL certificate and private key
const certPath = "../certs/server.crt"; // Update to your certificate path
const keyPath = "../certs/server.key"; // Update to your private key path

// Create an Oak application
const app = new Application();

// Middleware to serve the `index.html` file from the root directory
app.use(async (ctx) => {
    try {
        console.log("fetched data on server...");
        ctx.response.headers.append("X-Frame-Options", "SAMEORIGIN"); // deny iframe from other origins
        await ctx.send({
            root: `${Deno.cwd()}/`,
            index: "index.html",
        });
    } catch {
        console.log(Deno.cwd());

        ctx.response.status = 404;
        ctx.response.body = await Deno.readFileSync(`${Deno.cwd()}/404.html`);
    }
});

// Define the options for TLS (SSL certificates)
const options = {
    port: 8080,
    cert: await Deno.readTextFile(certPath),
    key: await Deno.readTextFile(keyPath),
};

// Start the HTTPS server using serveTls
//serveTls(handler, options);

app.listen(options);

console.log("HTTPS server is running on https://localhost:8080");
