export let githubClientID: string;
export let githubClientSecret: string;
export let sessionSecret: string;
export const port = 9990;

try {
    const secret = require("./secret");
    secret.load();
} catch (e) {
    console.log(e);
}
