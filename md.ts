/// <reference path="typings/tsd.d.ts" />

import * as express from "express";
import * as passport from "passport";
const session = require("express-session");
const GitHubStrategy = require("passport-github").Strategy;
import * as moment from "moment";

import * as settings from "./settings";

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

const strategy = new GitHubStrategy({
    clientID: settings.githubClientID,
    clientSecret: settings.githubClientSecret
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(function() {
        return done(null, profile);
    });
});

passport.use(strategy);

const app = express();

app.use(session({
    secret: settings.sessionSecret,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + "/static"));

app.get("/auth/github",
    passport.authenticate("github", { scope: [] }),
    function(req, res) {
    });

app.get("/auth/github/callback",
    passport.authenticate("github", { failureRedirect: "/" }),
    function(req, res) {
        res.redirect("/");
    });

app.get("/logout", function(req, res) {
    req.logout();
    res.redirect("/");
});

app.get("/user", function(req, res) {
    res.json(req.user);
});

app.listen(settings.port);
console.log(`listening ${settings.port}`);

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.redirect('/login')
}
