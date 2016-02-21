/// <reference path="typings/tsd.d.ts" />

import * as express from "express";
import * as passport from "passport";
const session = require("express-session");
const GitHubStrategy = require("passport-github").Strategy;
import * as moment from "moment";
import * as socketIO from "socket.io";

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

const sessionMiddleware = session({
    secret: settings.sessionSecret,
    resave: false,
    saveUninitialized: false
});

app.use(sessionMiddleware);

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

const server = app.listen(settings.port);
console.log(`listening ${settings.port}`);

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login')
}

const io = socketIO(server);
const text = io.of("/text");

text.use(function(socket, next) {
    sessionMiddleware(socket.request, {}, next);
}).on("connection", socket => {
    if (socket.request.session.passport === undefined) {
        socket.disconnect(true);
    } else {
        socket.on("text changed", text => {
            console.log(text);
        });
    }
});
