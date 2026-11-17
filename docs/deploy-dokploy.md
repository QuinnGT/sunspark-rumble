# Deploy to Dokploy

Sunspark Rumble is a fully static site. The `Dockerfile` builds it (`npm ci`, the surface gate, `npm run build`, `npm run build:web`) and serves `dist/` with nginx on port 80. There are no secrets and no runtime environment variables. The only input is the `SITE_URL` build argument, which makes the Open Graph, Twitter and canonical tags absolute.

## Steps

1. In the Dokploy panel, open **Git**, choose **GitHub**, and install the Dokploy GitHub App on `QuinnGT/sunspark-rumble`. See the [Dokploy GitHub guide](https://docs.dokploy.com/docs/core/github). Skip this if the app is already connected.
2. Create an **Application** in a project and set its source to GitHub: repository `QuinnGT/sunspark-rumble`, branch `main`.
3. Set **Build Type** to **Dockerfile**. Use **Dockerfile Path** `Dockerfile` and **Docker Context Path** `.`. Leave **Docker Build Stage** empty so the final nginx stage is built. ([Build Type docs](https://docs.dokploy.com/docs/core/applications/build-type))
4. Open the **Environment** tab. Under **Build Time Arguments**, add:

   ```
   SITE_URL=https://your-public-domain.example
   ```

   Use the public https URL with no trailing slash. If you leave it out, those tags stay relative or are omitted.
5. Open **Domains** and add a domain: **Host** is your hostname, **Container Port** is `80`, **HTTPS** is on, and **Certificate** is `letsencrypt`. Point the hostname's DNS at the Dokploy server first. ([Domains docs](https://docs.dokploy.com/docs/core/domains))
6. Click **Deploy**. On the **General** tab, check that **Auto Deploy** is on. With the GitHub App connection, each push to `main` redeploys. ([Auto Deploy docs](https://docs.dokploy.com/docs/core/auto-deploy))

The first build takes a while: `npm ci`, the surface gate, and an esbuild bundle of about 25 MB. The `Dockerfile` copies the package files before the source, so Docker can reuse the `npm ci` layer while `package.json` and `package-lock.json` are unchanged. Dokploy's own guidance notes that building on the server can use a lot of RAM and CPU, so give the host some headroom ([Going Production](https://docs.dokploy.com/docs/core/applications/going-production)).

If you change `SITE_URL`, redeploy so the image is rebuilt with the new value.

## Test the image locally

From the repository root:

```
docker build --build-arg SITE_URL=http://127.0.0.1:8080 -t sunspark-rumble:test .
docker run --rm -p 127.0.0.1:8080:80 sunspark-rumble:test
```

Open <http://127.0.0.1:8080/>. In another terminal, check the headers:

```
curl -I -H "Accept-Encoding: gzip" http://127.0.0.1:8080/game.bundle.js
```

Expect `Content-Encoding: gzip`, `Cache-Control: no-cache`, an `ETag`, and the `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` headers.

## What the container serves

`deploy/nginx.conf` serves `dist/` from the site root. HTML, JS, CSS and text files revalidate through their ETag (`Cache-Control: no-cache`). Images and the favicon cache for one day. Precompressed `.gz` files are used when the browser accepts gzip. Unknown paths return 404, and there is no single-page-app fallback.

The Content Security Policy allows only same-origin resources, plus `data:` and `blob:` for images and connections. Page changes that add inline scripts, inline event handlers or HTML `style` attributes are blocked by it.
