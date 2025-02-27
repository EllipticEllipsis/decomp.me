const { execSync } = require("child_process")

const { config } = require("dotenv")

for (const envFile of [".env.local", ".env"]) {
    config({ path: `../${envFile}` })
}

const getEnvBool = (key, fallback=false) => {
    const value = process.env[key]
    if (value === "false" || value === "0" || value === "off") {
        return false
    }
    if (value === "true" || value === "1" || value === "on") {
        return true
    }
    return fallback
}

let git_hash
try {
    git_hash = execSync("git rev-parse HEAD").toString().trim()
} catch (error) {
    console.log("Unable to get git hash, assume running inside Docker")
    git_hash = "abc123"
}

const { withPlausibleProxy } = require("next-plausible")

const withPWA = require("next-pwa")({
    dest: "public",
    disable: !getEnvBool("FRONTEND_PWA"),
})
const removeImports = require("next-remove-imports")({
    //test: /node_modules([\s\S]*?)\.(tsx|ts|js|mjs|jsx)$/,
    //matchImports: "\\.(less|css|scss|sass|styl)$"
})

const mediaUrl = new URL(process.env.MEDIA_URL ?? "http://localhost")

let app = withPlausibleProxy({
    customDomain: "https://stats.decomp.me",
})(removeImports(withPWA({
    async redirects() {
        return [
            {
                source: "/scratch",
                destination: "/",
                permanent: true,
            },
            {
                source: "/scratch/new",
                destination: "/new",
                permanent: true,
            },
            {
                source: "/settings",
                destination: "/settings/account",
                permanent: false,
            },
        ]
    },
    async rewrites() {
        return []
    },
    async headers() {
        return [
            {
                source: "/(.*)", // all routes
                headers: [
                    {
                        key: "X-DNS-Prefetch-Control",
                        value: "on",
                    },

                ],
            },
        ]
    },
    webpack(config) {
        config.module.rules.push({
            test: /\.svg$/,
            use: ["@svgr/webpack"],
        })

        return config
    },
    images: {
        domains: [mediaUrl.hostname, "avatars.githubusercontent.com"],
        unoptimized: !getEnvBool("FRONTEND_USE_IMAGE_PROXY"),
    },
    swcMinify: true,
    experimental: {
        appDir: true,
    },
    env: {
        // XXX: don't need 'NEXT_PUBLIC_' prefix here; we could just use 'API_BASE' and 'GITHUB_CLIENT_ID'
        // See note at top of https://nextjs.org/docs/api-reference/next.config.js/environment-variables for more information
        NEXT_PUBLIC_API_BASE: process.env.API_BASE,
        NEXT_PUBLIC_GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
        NEXT_PUBLIC_COMMIT_HASH: git_hash,
    },
})))

if (process.env.ANALYZE == "true") {
    app = require("@next/bundle-analyzer")(app)
}

module.exports = app
